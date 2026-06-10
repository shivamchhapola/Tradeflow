"""
Market data endpoints for the Trade page (NSE only).

  GET /api/option-chain      — NIFTY option chain
  GET /api/nifty-chart        — NIFTY 50 ~1m index chart (NSE indexTrackerApi)
  GET /api/option-candles     — Selected option premium candles
"""

import logging

from fastapi import APIRouter, HTTPException

from data.nifty_chart import get_nifty_intraday_chart
from data.nse import get_option_candles, get_option_chain

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.get("/option-chain")
async def option_chain(symbol: str = "NIFTY"):
    """Fetch the nearest-expiry option chain from NSE."""
    try:
        return await get_option_chain(symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NSE API error: {e}")


@router.get("/nifty-chart")
def nifty_chart(interval_minutes: int = 5):
    """Fetch NIFTY 50 candles from NSE index tracker API.

    interval_minutes: candle bucket size in minutes (default 5).
    5m gives proper OHLC bodies; 1m gives flat candles (one tick per minute).
    """
    try:
        return get_nifty_intraday_chart(interval_minutes)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NIFTY chart API error: {e}")


@router.get("/option-candles")
def option_candles(identifier: str, interval_seconds: int = 300):
    """Fetch selected NIFTY option premium candles from NSE."""
    try:
        return get_option_candles(identifier, interval_seconds)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"NSE option chart API error: {e}")
