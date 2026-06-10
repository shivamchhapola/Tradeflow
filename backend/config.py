"""
Tradeflow Engine — Configuration

Ported from Google Apps Script CONFIG.
Weights represent the directional influence of each asset on NIFTY.
Negative weight = inverse relationship (e.g. DXY up = bearish for NIFTY).
"""

WEIGHTS = {
    "GIFT NIFTY":   0.40,
    "NASDAQ":       0.10,
    "S&P 500":      0.05,
    "Nikkei":       0.05,
    "Crude Oil":   -0.10,
    "DXY":         -0.15,
    "US VIX":      -0.10,
    "US 10Y Bond": -0.05,
}

# Symbol → display-name map. The sentinel "__GIFT_NIFTY__" is handled
# separately by the fetcher (NSE marketStatus endpoint); everything else is
# a yfinance ticker.
SYMBOL_MAP = {
    "__GIFT_NIFTY__": "GIFT NIFTY",
    "^IXIC":          "NASDAQ",
    "^GSPC":          "S&P 500",
    "^N225":          "Nikkei",
    "CL=F":           "Crude Oil",
    "DX-Y.NYB":       "DXY",
    "^VIX":           "US VIX",
    "^TNX":           "US 10Y Bond",
}

# Current SEBI Lot Sizes (Verified May 2026)
# Used to validate frontend quantities.
LOT_SIZES = {
    "NIFTY": 65,
    "BANKNIFTY": 30,
    "FINNIFTY": 60,
}

DB_PATH = "tradeflow.db"

# Trade-page display chart only. This is NIFTY 50 cash index context, not a
# GIFT NIFTY pre-market source and not an option-premium source.
NIFTY_CHART_SYMBOL = "^NSEI"
