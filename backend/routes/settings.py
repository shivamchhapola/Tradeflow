"""
Tradeflow — Settings API Routes

CRUD for runtime settings (LLM provider, data sources, general config).
Settings are stored in settings.json (not the database) so advanced users
can edit them directly.
"""

import time
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from auth.dependencies import get_current_user
from models import User
from settings import get_settings, update_settings, mask_secrets, check_settings_configured
from llm.provider import get_llm_provider

logger = logging.getLogger("tradeflow.routes.settings")
router = APIRouter(prefix="/api/settings", tags=["Settings"])


# ── GET /api/settings ──

@router.get("")
def read_settings(current_user: User = Depends(get_current_user)):
    """Return current settings with API keys masked."""
    return mask_secrets(get_settings())


# ── GET /api/settings/status ──

@router.get("/status")
def settings_configuration_status(current_user: User = Depends(get_current_user)):
    """Return whether required settings are configured."""
    return check_settings_configured()


from data.nse_session import invalidate_nse_session

# ── PUT /api/settings ──

class SettingsUpdate(BaseModel):
    llm: Optional[dict] = None
    data_sources: Optional[dict] = None
    general: Optional[dict] = None

@router.put("")
def write_settings(
    body: SettingsUpdate,
    current_user: User = Depends(get_current_user),
):
    """Partial-update settings. Deep-merges into current values."""
    patch = {}
    if body.llm is not None:
        patch["llm"] = body.llm
    if body.data_sources is not None:
        patch["data_sources"] = body.data_sources
    if body.general is not None:
        patch["general"] = body.general

    if not patch:
        raise HTTPException(400, "No settings provided.")

    if body.data_sources is not None:
        invalidate_nse_session()

    updated = update_settings(patch)
    return mask_secrets(updated)


# ── GET /api/settings/llm/status ──

@router.get("/llm/status")
def llm_status(current_user: User = Depends(get_current_user)):
    """Health-check the currently configured LLM provider."""
    try:
        provider = get_llm_provider()
        return provider.health_check()
    except Exception as e:
        return {
            "ok": False,
            "provider": "unknown",
            "model": "unknown",
            "detail": f"Failed to initialize provider: {e}",
        }


# ── POST /api/settings/llm/test ──

@router.post("/llm/test")
def llm_test(current_user: User = Depends(get_current_user)):
    """Send a brief test prompt to verify LLM works end-to-end."""
    try:
        provider = get_llm_provider()
        prompt = "Respond with exactly one sentence: What is a call option in simple terms?"
        start = time.time()
        response = provider.generate(prompt)
        latency_ms = int((time.time() - start) * 1000)
        preview = response.strip()[:200]
        return {
            "ok": True,
            "provider": provider.provider_name,
            "model": provider.model_name,
            "response_preview": preview,
            "latency_ms": latency_ms,
        }
    except Exception as e:
        logger.error("LLM test failed: %s", e)
        return {
            "ok": False,
            "provider": "unknown",
            "model": "unknown",
            "response_preview": "",
            "latency_ms": 0,
            "detail": str(e),
        }


# ── POST /api/settings/data-sources/test ──

@router.post("/data-sources/test")
def data_sources_test(current_user: User = Depends(get_current_user)):
    """Test connection to NSE Base URL and Global Indices Base URL."""
    import requests
    from data.nse_session import get_nse_base_url, get_nse_headers, get_nse_timeout
    from data.fetcher import get_yfinance_base_url

    nse_url = get_nse_base_url()
    yf_url = get_yfinance_base_url()
    timeout = get_nse_timeout()

    results = {"ok": True, "nse": {}, "yfinance": {}}

    # Test NSE
    if not nse_url:
        results["nse"] = {"ok": False, "detail": "NSE Base URL is not configured."}
        results["ok"] = False
    else:
        try:
            headers = get_nse_headers()
            r = requests.get(nse_url, headers=headers, timeout=timeout)
            if r.status_code == 200:
                results["nse"] = {"ok": True, "detail": f"NSE Base URL ({nse_url}) reachable (HTTP 200)."}
            else:
                results["nse"] = {"ok": False, "detail": f"NSE returned HTTP {r.status_code}."}
                results["ok"] = False
        except Exception as e:
            results["nse"] = {"ok": False, "detail": f"Cannot connect to NSE Base URL: {e}"}
            results["ok"] = False

    # Test Yahoo Finance / Global Indices
    try:
        url = f"{yf_url}/v8/finance/chart/%5ENSEI?range=1d&interval=1d"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = requests.get(url, headers=headers, timeout=timeout)
        if r.status_code == 200:
            results["yfinance"] = {"ok": True, "detail": f"Global Indices Base URL ({yf_url}) reachable (HTTP 200)."}
        else:
            results["yfinance"] = {"ok": False, "detail": f"Global Indices returned HTTP {r.status_code}."}
            results["ok"] = False
    except Exception as e:
        results["yfinance"] = {"ok": False, "detail": f"Cannot connect to Global Indices Base URL: {e}"}
        results["ok"] = False

    return results


# ── POST /api/settings/reset ──

@router.post("/reset")
def reset_settings(current_user: User = Depends(get_current_user)):
    """Reset settings back to factory defaults."""
    from settings import DEFAULTS, update_settings
    updated = update_settings(DEFAULTS)
    invalidate_nse_session()
    return mask_secrets(updated)
