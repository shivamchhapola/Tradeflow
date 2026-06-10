"""
Tradeflow Engine — NSE Option Data

Fetches delayed NIFTY option-chain snapshots and selected option premium charts
from NSE's public API. These calls are suitable for paper trading context, not
for order routing or signal generation.

Uses the shared cached session from `data.nse_session` so NSE receives a cookie
warm-up before API endpoints. If NSE returns 401/403, the session is
invalidated and retried once.
"""

from datetime import datetime
import asyncio

import pytz
from urllib.parse import quote
from fastapi_cache.decorator import cache

IST = pytz.timezone("Asia/Kolkata")

from data.nse_session import (
    get_nse_session,
    invalidate_nse_session,
    get_nse_base_url,
    get_nse_headers,
)



# ── In-process caches ──────────────────────────────────────────────────────
# Expiry cache: the nearest weekly expiry only changes once a week.
# Caching it per calendar day removes one NSE round-trip per refresh.
_EXPIRY_CACHE: dict = {"day": None, "expiry": None}


def _parse_nse_expiry(value: str):
    for fmt in ("%d-%b-%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def _safe_float(value):
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _option_ltp_chg_pct(leg: dict) -> float | None:
    return _safe_float(leg.get("pChange"))


def _option_oi_chg_pct(leg: dict) -> float | None:
    for key in ("pchangeinOpenInterest", "pChangeinOpenInterest", "pchangeInOpenInterest"):
        pct = _safe_float(leg.get(key))
        if pct is not None:
            return pct
    oi = _safe_float(leg.get("openInterest"))
    chg = _safe_float(leg.get("changeinOpenInterest"))
    if oi is not None and chg is not None and oi - chg != 0:
        prior = oi - chg
        if prior > 0:
            return (chg / prior) * 100
    return None


def _get_json_with_retry(url: str, referer: str) -> dict:
    response = None
    headers = get_nse_headers()
    headers["Referer"] = referer
    for attempt in (1, 2):
        session = get_nse_session()
        response = session.get(url, headers=headers, timeout=10)
        if response.status_code in (401, 403) and attempt == 1:
            invalidate_nse_session()
            continue
        break
    if response is None:
        raise RuntimeError("Failed to obtain a response from NSE.")

    response.raise_for_status()
    return response.json()


def _warm_option_chain_page(base_url: str) -> None:
    session = get_nse_session()
    headers = get_nse_headers()
    session.get(
        f"{base_url}/option-chain?type=Indices&symbol=NIFTY",
        headers=headers,
        timeout=10,
    )


def _get_nearest_expiry(symbol: str) -> str:
    """Return the nearest upcoming expiry string for `symbol`.

    Caches the result per calendar day — the expiry only changes on expiry
    day (Thursday for NIFTY weekly), so the contract-info round-trip only
    happens once per trading day instead of on every chain refresh.
    """
    today = datetime.now(IST).date()
    if _EXPIRY_CACHE["day"] == today and _EXPIRY_CACHE["expiry"]:
        return _EXPIRY_CACHE["expiry"]

    base_url = get_nse_base_url()
    if not base_url:
        raise ValueError("NSE Base URL is not configured in settings")
        
    contract_url = (
        f"{base_url}/api/option-chain-contract-info"
        f"?symbol={quote(symbol)}"
    )
    contract_info = _get_json_with_retry(contract_url, referer=f"{base_url}/option-chain?type=Indices&symbol={quote(symbol)}")

    valid_expiries = []
    for exp in contract_info.get("expiryDates", []):
        exp_date = _parse_nse_expiry(exp)
        if exp_date and exp_date >= today:
            valid_expiries.append((exp_date, exp))

    if not valid_expiries:
        raise ValueError("NSE returned no valid upcoming NIFTY expiries")

    expiry = sorted(valid_expiries, key=lambda item: item[0])[0][1]
    _EXPIRY_CACHE["day"] = today
    _EXPIRY_CACHE["expiry"] = expiry
    return expiry


@cache(expire=10)
async def get_option_chain(symbol: str = "NIFTY") -> dict:
    """Fetch the nearest-expiry NIFTY option chain.
    
    Uses fastapi-cache2 with a 10s TTL to prevent hammering NSE.
    """
    symbol = symbol.upper()
    if symbol != "NIFTY":
        raise ValueError("Only NIFTY option chain is supported on the Trade page")

    base_url = get_nse_base_url()
    if not base_url:
        raise ValueError("NSE Base URL is not configured in settings")

    await asyncio.to_thread(_warm_option_chain_page, base_url)

    expiry = await asyncio.to_thread(_get_nearest_expiry, symbol)
    chain_url = (
        f"{base_url}/api/option-chain-v3"
        f"?type=Indices&symbol={quote(symbol)}&expiry={quote(expiry)}"
    )
    data = await asyncio.to_thread(_get_json_with_retry, chain_url, f"{base_url}/option-chain?type=Indices&symbol={quote(symbol)}")
    
    if "records" not in data:
        raise ValueError("NSE option-chain payload did not include records")

    records = data["records"].get("data", [])
    underlying = data["records"].get("underlyingValue", 0)

    strikes = []
    for item in records:
        item_expiry = item.get("expiryDates") or item.get("expiryDate")
        if item_expiry and item_expiry != expiry:
            continue

        strike = item["strikePrice"]
        ce = item.get("CE", {})
        pe = item.get("PE", {})

        strikes.append({
            "strike": strike,
            "ce_ltp": ce.get("lastPrice", 0),
            "ce_ltp_chg_pct": _option_ltp_chg_pct(ce),
            "ce_oi": ce.get("openInterest", 0),
            "ce_oi_chg_pct": _option_oi_chg_pct(ce),
            "ce_iv": ce.get("impliedVolatility", 0),
            "ce_vol": ce.get("totalTradedVolume", 0),
            "ce_identifier": ce.get("identifier"),
            "pe_ltp": pe.get("lastPrice", 0),
            "pe_ltp_chg_pct": _option_ltp_chg_pct(pe),
            "pe_oi": pe.get("openInterest", 0),
            "pe_oi_chg_pct": _option_oi_chg_pct(pe),
            "pe_iv": pe.get("impliedVolatility", 0),
            "pe_vol": pe.get("totalTradedVolume", 0),
            "pe_identifier": pe.get("identifier"),
        })

    nse_ts = data["records"].get("timestamp")
    fetched_at = datetime.now(IST).isoformat()

    return {
        "expiry": expiry,
        "underlying": underlying,
        "timestamp": nse_ts,
        "fetched_at": fetched_at,
        "source": "nse",
        "delay_note": "~15 min delayed (NSE free feed)",
        "strikes": strikes,
    }


def get_option_candles(identifier: str, interval_seconds: int = 300) -> dict:
    """Fetch an NSE option premium tick chart and aggregate it into OHLC candles."""
    if not identifier or not identifier.startswith("OPTIDXNIFTY"):
        raise ValueError("Only NIFTY option identifiers are supported")

    base_url = get_nse_base_url()
    if not base_url:
        raise ValueError("NSE Base URL is not configured in settings")

    interval_seconds = max(60, min(interval_seconds, 900))
    chart_url = (
        f"{base_url}/api/chart-databyindex"
        f"?index={quote(identifier)}&indices=false"
    )
    data = _get_json_with_retry(chart_url, referer=f"{base_url}/option-chain?type=Indices&symbol=NIFTY")
    raw_points = data.get("grapthData") or data.get("graphData") or []
    if not raw_points:
        raise ValueError("NSE returned no option chart points")

    buckets = {}
    for point in raw_points:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            ts_ms = int(point[0])
            price = float(point[1])
        except (TypeError, ValueError):
            continue

        bucket = (ts_ms // 1000 // interval_seconds) * interval_seconds
        candle = buckets.setdefault(
            bucket,
            {"time": bucket, "open": price, "high": price, "low": price, "close": price},
        )
        candle["high"] = max(candle["high"], price)
        candle["low"] = min(candle["low"], price)
        candle["close"] = price

    candles = [buckets[key] for key in sorted(buckets)]
    if not candles:
        raise ValueError("NSE option chart payload had no parseable prices")

    return {
        "identifier": identifier,
        "name": data.get("name") or "NIFTY",
        "source": "NSE",
        "interval_seconds": interval_seconds,
        "candles": candles,
        "last": candles[-1]["close"],
    }
