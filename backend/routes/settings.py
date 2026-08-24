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
from settings import get_settings, update_settings, mask_secrets
from llm.provider import get_llm_provider

logger = logging.getLogger("tradeflow.routes.settings")
router = APIRouter(prefix="/api/settings", tags=["Settings"])


# ── GET /api/settings ──

@router.get("")
def read_settings(current_user: User = Depends(get_current_user)):
    """Return current settings with API keys masked."""
    return mask_secrets(get_settings())


@router.get("/status")
def settings_status(current_user: User = Depends(get_current_user)):
    """Check if initial configuration has been completed."""
    settings = get_settings()
    is_configured = bool(settings)
    return {"is_configured": is_configured, "settings": mask_secrets(settings)}


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
