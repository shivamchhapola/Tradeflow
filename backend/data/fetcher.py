"""
Tradeflow Engine — Market Data Fetcher

Data sources for the pre-market analysis:
  • GIFT NIFTY  → NSE India /api/marketStatus
  • All others  → yfinance (reliable for global indices / futures)

GIFT NIFTY uses NSE's public marketStatus endpoint (canonical, no broker auth).
The Trade tab uses separate NSE endpoints for the index chart and option chain.
"""

import logging
import os
import concurrent.futures
from typing import Optional

import yfinance as yf
from dotenv import load_dotenv

from config import WEIGHTS, SYMBOL_MAP
from data.nse_session import (
    get_nse_headers,
    get_nse_session,
    invalidate_nse_session,
    get_nse_base_url,
)

log = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))


# ---------------------------------------------------------------------------
# GIFT NIFTY via NSE
# ---------------------------------------------------------------------------




def _fetch_gift_nifty_change_pct() -> Optional[float]:
    """
    Fetch GIFT NIFTY % via NSE's public marketStatus endpoint.

    Uses the cached `nse_session` (one cookie warm-up per process). If NSE
    returns 401/403 we assume the cookie expired, invalidate the cache, and
    retry once with a freshly warmed-up session.
    """
    base_url = get_nse_base_url()
    if not base_url:
        log.warning("GIFT NIFTY fetch skipped: nse_base_url not configured in settings.")
        return None

    url = f"{base_url}/api/marketStatus"

    for attempt in (1, 2):
        try:
            session = get_nse_session()
            resp = session.get(
                url, headers=get_nse_headers(), timeout=10
            )
            if resp.status_code in (401, 403) and attempt == 1:
                # Cookie expired — drop the cached session and retry once.
                invalidate_nse_session()
                continue
            resp.raise_for_status()
            data = resp.json()
            gift = data.get("giftnifty", {})
            per_change = gift.get("PERCHANGE")
            if per_change is not None:
                pct = round(float(per_change), 2)
                last = gift.get("LASTPRICE", "?")
                log.info("GIFT NIFTY from NSE: %+.2f%% (LTP=%s)", pct, last)
                return pct
            return None
        except Exception as e:
            log.warning("NSE marketStatus failed (attempt %d): %s", attempt, e)
            if attempt == 1:
                invalidate_nse_session()
    return None


# ---------------------------------------------------------------------------
# yfinance helper
# ---------------------------------------------------------------------------

def _fetch_yfinance_change_pct(symbol: str) -> Optional[float]:
    # `period="5d"` (not 2d) so we still get >= 2 daily bars on weekends,
    # US holidays, and contract-roll gaps. CME/ICE futures (CL=F, DX-Y.NYB)
    # don't trade Friday-evening → Sunday-evening; a 2-day window over a
    # Sunday returns ONE row for them (just Friday) and we'd silently mark
    # the market unavailable. 5d is the smallest window that covers a full
    # business week so we always have a previous-close to compare against.
    # The response is still tiny — no perf cost over 2d.
    try:
        hist = yf.Ticker(symbol).history(period="5d")
        if len(hist) < 2:
            # Explicit log so future "unavailable" rows aren't mysterious —
            # the silent `return None` here was what made this hard to
            # debug the first time around.
            log.warning(
                "yfinance %s: only %d bar(s) returned, need >=2 for %% change.",
                symbol, len(hist),
            )
            return None
        prev = float(hist["Close"].iloc[-2])
        last = float(hist["Close"].iloc[-1])
        return round(((last - prev) / prev) * 100, 2)
    except Exception as e:
        log.warning("yfinance error for %s: %s", symbol, e)
        return None


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def fetch_market_data(user_id: Optional[int] = None) -> list[dict]:
    """
    Fetch current market data for all tracked assets concurrently.

    Every market defined in SYMBOL_MAP is always included in the result, even
    when its fetch fails. Failed rows carry ``"error": True`` and
    ``"changePercent": None`` so the frontend can show a visible "unavailable"
    state rather than silently dropping the row (which made Nikkei disappear
    whenever yfinance had a hiccup).

    `user_id` is accepted for API compatibility but unused — all sources are NSE/yfinance.
    """
    results = []

    # ── Map symbols ───────────────────────────────────────────────────────
    symbols_to_fetch = {sym: name for sym, name in SYMBOL_MAP.items() if sym != "__GIFT_NIFTY__"}

    # Execute GIFT NIFTY and yfinance symbols concurrently
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(symbols_to_fetch) + 1) as executor:
        # Submit GIFT NIFTY
        gift_future = executor.submit(_fetch_gift_nifty_change_pct)
        
        # Submit all other symbols
        future_to_sym = {executor.submit(_fetch_yfinance_change_pct, sym): sym for sym in symbols_to_fetch}

        # ── Resolve GIFT NIFTY ────────────────────────────────────────────
        weight = WEIGHTS.get("GIFT NIFTY", 0)
        try:
            gift_change = gift_future.result()
            if gift_change is not None:
                results.append({
                    "market":            "GIFT NIFTY",
                    "changePercent":     gift_change,
                    "weightAssigned":    weight,
                    "scoreContribution": round(gift_change * weight / 100, 4),
                })
            else:
                log.warning("GIFT NIFTY unavailable — including as error row.")
                results.append({
                    "market":            "GIFT NIFTY",
                    "changePercent":     None,
                    "weightAssigned":    weight,
                    "scoreContribution": 0,
                    "error":             True,
                })
        except Exception as e:
            log.warning("Unexpected error for GIFT NIFTY: %s", e)
            results.append({
                "market":            "GIFT NIFTY",
                "changePercent":     None,
                "weightAssigned":    weight,
                "scoreContribution": 0,
                "error":             True,
            })

        # ── Resolve other symbols (yfinance) ──────────────────────────────
        for future in concurrent.futures.as_completed(future_to_sym):
            sym = future_to_sym[future]
            name = symbols_to_fetch[sym]
            weight = WEIGHTS.get(name, 0)
            try:
                change_pct = future.result()
                if change_pct is not None:
                    results.append({
                        "market":            name,
                        "changePercent":     change_pct,
                        "weightAssigned":    weight,
                        "scoreContribution": round(change_pct * weight / 100, 4),
                    })
                else:
                    log.warning("%s unavailable — including as error row.", name)
                    results.append({
                        "market":            name,
                        "changePercent":     None,
                        "weightAssigned":    weight,
                        "scoreContribution": 0,
                        "error":             True,
                    })
            except Exception as e:
                log.warning("Unexpected error for %s (%s): %s", sym, name, e)
                results.append({
                    "market":            name,
                    "changePercent":     None,
                    "weightAssigned":    weight,
                    "scoreContribution": 0,
                    "error":             True,
                })

    # Stable sort: by absolute weight descending so GIFT NIFTY always leads.
    results.sort(key=lambda r: abs(r["weightAssigned"]), reverse=True)
    return results
