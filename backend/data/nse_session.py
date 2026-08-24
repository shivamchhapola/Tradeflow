"""
Cached NSE session for both pre-market GIFT NIFTY fetches and live option
chain calls. NSE requires a cookie from the homepage before any /api/
endpoint will return JSON; we cache that warmed-up session at module level
so we only pay the round-trip once per process.

Used by:
  * backend/data/fetcher.py — GIFT NIFTY pre-market fetch
  * backend/data/nse.py     — live NIFTY option chain (Trade tab)

If you ever add a new NSE endpoint, route it through `get_nse_session()`
and `NSE_HEADERS` here; don't reinvent the warm-up locally.
"""

from __future__ import annotations

import logging
import threading
from typing import Optional

import requests

log = logging.getLogger(__name__)

from settings import get_settings

def get_nse_base_url() -> str:
    url = get_settings().get("data_sources", {}).get("nse_base_url", "")
    return url.rstrip("/")

def get_nse_headers() -> dict:
    base_url = get_nse_base_url()
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": base_url if base_url else "https://www.google.com/",
    }

_session: Optional[requests.Session] = None
_lock = threading.Lock()


def get_nse_session() -> requests.Session:
    """Return the cached NSE session, warming it up lazily on first call.

    Double-checked locking is correct here because FastAPI dispatches sync
    handlers into a thread pool — multiple worker threads can race the first
    warm-up. The inner re-check after acquiring the lock ensures we only do
    the homepage GET once even under contention.
    """
    global _session
    base_url = get_nse_base_url()
    if not base_url:
        raise ValueError("NSE Base URL is not configured in Settings.")

    if _session is None:
        with _lock:
            if _session is None:
                s = requests.Session()
                s.get(base_url, headers=get_nse_headers(), timeout=10)
                _session = s
                log.info("NSE session initialised (cookie warmed up).")
    return _session


def invalidate_nse_session() -> None:
    """Drop the cached session so the next call re-warms it.

    Call this when an NSE request returns 401/403 — the cookie has expired
    and the next request needs a fresh one. Callers should retry once after
    invalidating; see `_fetch_gift_nifty_nse` in fetcher.py for the pattern.
    """
    global _session
    with _lock:
        _session = None
    log.info("NSE session invalidated; next call will re-warm.")
