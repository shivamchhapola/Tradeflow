"""
Tradeflow Engine — Quant Scoring

Generates the macro bias score from global market data.
Ported from generateQuantData() in Google Apps Script.
"""

from datetime import datetime
import pytz

from data.fetcher import fetch_market_data

IST = pytz.timezone("Asia/Kolkata")


def generate_quant_data() -> dict:
    """
    Fetch market data and compute the aggregate bias score.

    Returns:
        {
            "final_bias_score": -0.234,
            "market_bias": "Bearish",
            "market_data": [...],
            "analysis_time": "2026-05-17T08:12:34+05:30",  # IST ISO datetime
        }

    `analysis_time` is a full IST ISO datetime (not just HH:MM:SS) so the
    frontend can compute relative-time strings like "2m ago" without having
    to invent today's date. The cached path in `main.py` (which returns
    `row["run_at"]`) already uses this same format — keeping them aligned.
    """
    market_data = fetch_market_data()
    score = round(sum(a["scoreContribution"] for a in market_data), 4)

    if score >= 0.3:
        bias = "Strong Bullish"
    elif score >= 0.1:
        bias = "Bullish"
    elif score <= -0.3:
        bias = "Strong Bearish"
    elif score <= -0.1:
        bias = "Bearish"
    else:
        bias = "Neutral"

    return {
        "final_bias_score": score,
        "market_bias":      bias,
        "market_data":      market_data,
        "analysis_time":    datetime.now(IST).isoformat(),
    }
