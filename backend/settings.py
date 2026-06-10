"""
Tradeflow — Runtime Settings Store

File-based JSON settings with schema defaults, deep-merge writes,
and atomic file operations. Settings are read fresh on every access
(no stale cache) and written atomically (temp + rename).

Location: settings.json in project root (next to tradeflow.db).
"""

import os
import sys
import json
import copy
import logging
import tempfile
from pathlib import Path
from threading import Lock
import platformdirs

logger = logging.getLogger("tradeflow.settings")

# Smart path resolution for Settings
_dev_settings_path = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "settings.json")
)

# If running in a PyInstaller bundle, or if we want the production Documents path:
if getattr(sys, 'frozen', False) or not os.path.exists(_dev_settings_path):
    # C:\Users\<user>\Documents\Tradeflow\settings.json
    _docs_dir = platformdirs.user_documents_dir()
    _settings_dir = os.path.join(_docs_dir, "Tradeflow")
    os.makedirs(_settings_dir, exist_ok=True)
    SETTINGS_FILE = os.path.join(_settings_dir, "settings.json")
else:
    # Use the root directory if the settings file is already there (local development)
    SETTINGS_FILE = _dev_settings_path

DEFAULTS = {
    "version": 1,
    "llm": {
        "provider": "ollama",
        "ollama_base_url": "http://localhost:11434",
        "ollama_model": "qwen3.5:4b",
        "groq_api_key": "",
        "groq_model": "llama-3.1-8b-instant",
    },
    "data_sources": {
        "option_chain": "nse",
        "gift_nifty": "nse",
        "nse_base_url": "",
    },
    "general": {
        "auto_squareoff_time": "15:15",
        "premarket_cron_time": "08:00",
    },
}

VALID_LLM_PROVIDERS = {"ollama", "groq"}
VALID_OPTION_CHAIN_SOURCES = {"nse"}
VALID_GIFT_NIFTY_SOURCES = {"nse"}

_write_lock = Lock()


def _deep_merge(base: dict, overlay: dict) -> dict:
    """Recursively merge overlay into a copy of base."""
    result = copy.deepcopy(base)
    for key, value in overlay.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def _validate(settings: dict) -> dict:
    """Clamp values to valid ranges. Returns the (possibly corrected) dict."""
    llm = settings.get("llm", {})
    if llm.get("provider") not in VALID_LLM_PROVIDERS:
        llm["provider"] = DEFAULTS["llm"]["provider"]
        logger.warning("Invalid LLM provider — reset to '%s'", llm["provider"])

    ds = settings.get("data_sources", {})
    if ds.get("option_chain") not in VALID_OPTION_CHAIN_SOURCES:
        ds["option_chain"] = DEFAULTS["data_sources"]["option_chain"]
    if ds.get("gift_nifty") not in VALID_GIFT_NIFTY_SOURCES:
        ds["gift_nifty"] = DEFAULTS["data_sources"]["gift_nifty"]

    # Allow Docker / Environment override for Ollama URL
    env_ollama = os.environ.get("OLLAMA_BASE_URL")
    if env_ollama and "llm" in settings:
        settings["llm"]["ollama_base_url"] = env_ollama

    return settings


def get_settings() -> dict:
    """Read settings from disk, merge with defaults, validate."""
    if not os.path.exists(SETTINGS_FILE):
        logger.info("settings.json not found — creating with defaults")
        _write_atomic(DEFAULTS)
        return copy.deepcopy(DEFAULTS)

    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            on_disk = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to read settings.json: %s — using defaults", e)
        return copy.deepcopy(DEFAULTS)

    merged = _deep_merge(DEFAULTS, on_disk)
    return _validate(merged)


def update_settings(patch: dict) -> dict:
    """Deep-merge patch into current settings, validate, write atomically."""
    current = get_settings()
    merged = _deep_merge(current, patch)
    validated = _validate(merged)
    _write_atomic(validated)
    logger.info("Settings updated: %s", list(patch.keys()))
    return validated


def mask_secrets(settings: dict) -> dict:
    """Return a copy with API keys masked for frontend display."""
    masked = copy.deepcopy(settings)
    llm = masked.get("llm", {})
    key = llm.get("groq_api_key", "")
    if key and len(key) > 4:
        llm["groq_api_key"] = "••••" + key[-4:]
    elif key:
        llm["groq_api_key"] = "••••"
    return masked


def _write_atomic(data: dict) -> None:
    """Write settings to a temp file, then atomically replace."""
    with _write_lock:
        parent = Path(SETTINGS_FILE).parent
        try:
            fd, tmp_path = tempfile.mkstemp(
                dir=str(parent), suffix=".tmp", prefix="settings_"
            )
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(tmp_path, SETTINGS_FILE)
        except OSError as e:
            logger.error("Failed to write settings.json: %s", e)
            # Clean up temp file if replace failed
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise
