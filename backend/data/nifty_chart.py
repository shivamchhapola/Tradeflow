"""NIFTY 50 intraday chart via NSE index tracker API (same feed as nseindia.com)."""

import logging
from datetime import datetime

import pytz

from data.nse_session import (
    get_nse_base_url,
    get_nse_headers,
    get_nse_session,
    invalidate_nse_session,
    get_nse_timeout,
)

log = logging.getLogger(__name__)

IST = pytz.timezone("Asia/Kolkata")


def _fetch_index_chart_payload() -> dict:
    """Warm session + fetch index chart JSON. Retries once on 401/403."""
    base_url = get_nse_base_url()
    if not base_url:
        raise ValueError("NSE Base URL is not configured in settings")

    chart_url = (
        f"{base_url}/api/NextApi/apiClient/indexTrackerApi"
        "?functionName=getIndexChart&&index=NIFTY%2050&flag=1D"
    )
    referer = f"{base_url}/"

    last_error = None
    for attempt in (1, 2):
        session = get_nse_session()
        try:
            response = session.get(
                chart_url,
                headers={**get_nse_headers(), "Referer": referer},
                timeout=get_nse_timeout(),
            )
            if response.status_code in (401, 403) and attempt == 1:
                invalidate_nse_session()
                continue
            response.raise_for_status()
            body = response.json()
            data = body.get("data") if isinstance(body, dict) else None
            if not data:
                raise ValueError("NSE index chart response missing data")
            return data
        except Exception as e:
            last_error = e
            if attempt == 1:
                invalidate_nse_session()
            else:
                raise
    raise ValueError(f"NSE index chart request failed: {last_error}")


def _graph_to_candles(graph_points: list, interval_minutes: int = 5) -> list[dict]:
    """
    NSE returns ~1-minute samples as [timestamp_ms, price, ...].
    Bucket into OHLC candles aligned to `interval_minutes`.
    Default 5-minute candles: groups 5 ticks together so each bar has
    a visible body/wick instead of appearing as a flat line.
    """
    interval_ms = interval_minutes * 60_000
    interval_s = interval_minutes * 60
    buckets: dict[int, dict] = {}
    for point in graph_points:
        if not isinstance(point, (list, tuple)) or len(point) < 2:
            continue
        try:
            ts_ms = int(point[0])
            price = float(point[1])
        except (TypeError, ValueError):
            continue
        bucket = (ts_ms // interval_ms) * interval_s
        candle = buckets.get(bucket)
        if candle is None:
            buckets[bucket] = {
                "time": bucket,
                "open": price,
                "high": price,
                "low": price,
                "close": price,
            }
        else:
            candle["high"] = max(candle["high"], price)
            candle["low"] = min(candle["low"], price)
            candle["close"] = price
    return [buckets[key] for key in sorted(buckets)]

def get_nifty_intraday_chart(interval_minutes: int = 5) -> dict:
    """
    Fetch NIFTY 50 cash index candles for the Trade page.

    Uses NSE's public indexTrackerApi (flag=1D = today's session).
    Default interval_minutes=5 groups 5 ticks per candle so bars have
    visible bodies/wicks instead of appearing as flat dots on the chart.
    """
    data = _fetch_index_chart_payload()
    raw = data.get("grapthData") or data.get("graphData") or []
    candles = _graph_to_candles(raw, interval_minutes)
    if not candles:
        raise ValueError("NSE index chart returned no parseable price points")

    points = [{"time": c["time"] * 1000, "value": c["close"]} for c in candles]
    close_price = data.get("closePrice")
    last = float(close_price) if close_price is not None else candles[-1]["close"]

    return {
        "symbol": "NIFTY",
        "name": data.get("name") or "NIFTY 50",
        "source": "NSE India",
        "interval": f"{interval_minutes}m",
        "fetched_at": datetime.now(IST).isoformat(),
        "points": points,
        "candles": candles,
        "last": last,
    }
