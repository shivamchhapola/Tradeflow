"""
Tradeflow Engine — Playbook Generator

Generates actionable trading playbook from quant data.
Ported from generatePlaybook() in Google Apps Script.

Includes: session context, signal alignment, volatility assessment,
grade classification, structure prediction, warnings, and scenario playbook.
"""

from datetime import datetime
import pytz

# IST timezone
IST = pytz.timezone("Asia/Kolkata")


def generate_playbook(quant_data: dict) -> dict:
    """
    Generate a full playbook from scored market data.

    Takes the output of generate_quant_data() and adds:
    - Session context (what time it is in IST)
    - Signal alignment meter
    - Volatility / theta / favorability assessment
    - Grade (A/B/C conviction)
    - Market structure prediction
    - Warnings
    - Scenario-based playbook (title, reasoning, action)
    """
    results = quant_data["market_data"]
    score = quant_data["final_bias_score"]

    # Flatten the market data into an O(1) lookup dictionary
    results_map = {r["market"]: r.get("changePercent") for r in results}

    def get(name: str) -> float:
        # `changePercent` is `None` when that market's fetch failed (the
        # fetcher returns all SYMBOL_MAP entries unconditionally, marking
        # unavailable ones with `error: true` and `changePercent: None`).
        # Treat missing data as 0 so it contributes nothing to bull/bear
        # alignment counts — "we don't have data" is not a directional
        # signal. Returning 0 also keeps the downstream `> 0` / `< 0`
        # comparisons total — they'd otherwise raise TypeError on None.
        cp = results_map.get(name)
        return cp if cp is not None else 0

    gift   = get("GIFT NIFTY")
    vix    = get("US VIX")
    tnx    = get("US 10Y Bond")
    crude  = get("Crude Oil")
    dxy    = get("DXY")
    nasdaq = get("NASDAQ")

    # ── Signal alignment ──
    bull_s = sum(1 for v in [
        gift > 0, vix < 0, tnx < 0, dxy < 0, crude < 0, nasdaq > 0
    ] if v)
    bear_s = sum(1 for v in [
        gift < 0, vix > 0, tnx > 0, dxy > 0, crude > 0, nasdaq < 0
    ] if v)
    delta = abs(bull_s - bear_s)

    alignment = (
        "Extreme alignment"  if delta >= 5 else
        "Strong alignment"   if delta >= 3 else
        "Moderate alignment" if delta >= 2 else
        "Conflicting signals"
    )

    # ── Session context (IST) ──
    ist = datetime.now(IST)
    ist_str = ist.strftime("%H:%M")
    ist_mins = ist.hour * 60 + ist.minute
    is_weekend = ist.weekday() >= 5  # Sat=5, Sun=6

    if is_weekend:
        session_label = "Weekend"
    else:
        session_label = (
            "Asian session"     if ist_mins < 420  else
            "Pre-market window" if ist_mins < 555  else
            "Market open"       if ist_mins <= 930 else
            "After hours"
        )

    # ── Volatility assessment ──
    if vix > 3 or (vix > 1.5 and crude > 1):
        volatility = "High expansion"
        theta = "Low (fast moves)"
        favor = "High for option buyers"
    elif vix < -2 and abs(score) < 0.15:
        volatility = "Contraction"
        theta = "Extreme — avoid OTM"
        favor = "Low (sellers market)"
    elif abs(score) >= 0.3:
        volatility = "Directional trend"
        theta = "Low if riding trend"
        favor = "High (directional)"
    else:
        volatility = "Normal range"
        theta = "Medium"
        favor = "Neutral"

    # ── Grade (conviction) ──
    if abs(score) > 0.35 and (
        (gift < 0 and vix > 0) or (gift > 0 and vix < 0)
    ):
        conviction, grade = "High conviction", "A"
    elif abs(score) < 0.12 or (
        (gift > 0.4 and score < 0) or (gift < -0.4 and score > 0)
    ):
        conviction, grade = "Low conviction / choppy", "C"
    else:
        conviction, grade = "Medium conviction", "B"

    # ── Structure prediction ──
    if score >= 0.35 and vix < -1:
        structure = "Trend day probable (bullish)"
    elif score <= -0.35 and vix > 1:
        structure = "Trend day probable (bearish)"
    elif abs(score) >= 0.2:
        structure = "Directional bias"
    else:
        structure = "Compression / sideways"

    # ── Warnings ──
    # Only surface warnings that add information NOT already conveyed by the
    # playbook title/reasoning or the conviction grade. The previous version
    # also emitted weekend / after-hours / "conflicting data" warnings, but
    # the playbook scenario block and the grade C circle on the dashboard
    # already say exactly that — duplicating it produced visual noise.
    warnings = []
    if session_label not in ["Weekend", "After hours", "Asian session"]:
        if vix > 2 and tnx > 1:
            warnings.append("Systemic fear: VIX and yields both surging. Avoid longs.")
        if gift > 0.6 and score < 0.1:
            warnings.append("GIFT strongly up but macros weak — gap-and-crap risk.")
        if gift < -0.6 and score > -0.1:
            warnings.append("GIFT gapping down but macros resilient — bear trap risk.")

    # ── Playbook scenario ──
    if session_label == "Weekend":
        title  = "Weekend — NSE closed"
        reason = (
            f"Indian markets are closed (Sat–Sun). Global score is {score:+.3f} based on "
            "Friday's close and any live futures data available. This is a directional read "
            "for how Monday may open — not an intraday signal."
        )
        action = (
            "Review last week's trades and mentor reports. "
            "Check if any macro thesis from Friday's playbook is tracking. "
            "Monday gap direction: " + ("bullish lean" if score >= 0.1 else "bearish lean" if score <= -0.1 else "neutral")
            + f" (score {score:+.3f})."
        )
    elif session_label == "After hours":
        title  = "Market Closed (After Hours)"
        reason = "The Indian market is currently closed. Global metrics reflect overnight or previous day's close."
        action = "Review today's trades. Fresh actionable signals will generate tomorrow at 8:00 AM."
    elif session_label == "Asian session":
        title  = "Asian Session (Too Early)"
        reason = "Global markets are still settling. Wait for the 8:00 AM pre-market run."
        action = "No action. Check back closer to the Indian market open."
    else:
        if vix > 1.5 and tnx > 0.5:
            title  = "Systemic fear / capital flight"
            reason = f"VIX +{vix}% and 10Y yields +{tnx}%. Toxic environment."
            action = "Avoid longs. Financials will be weak. Favor ATM puts."
        elif gift >= 0.4 and score <= 0.1:
            title  = "The fake-out (gap & crap)"
            reason = f"GIFT +{gift}% but global score weak ({score:.3f})."
            action = "Do NOT buy the open. Wait for first 5-min red candle."
        elif gift <= -0.4 and score >= -0.1:
            title  = "The trap (gap down recovery)"
            reason = f"GIFT {gift}% but macros resilient ({score:.3f})."
            action = "Watch for green rejection candle at open. Buy-on-dip setup."
        elif score >= 0.3:
            title  = "Macro-aligned bullish"
            reason = f"High positive score ({score:.3f}). Conditions align."
            action = "Don't fade the gap. Pullback to VWAP in first hour = buy."
        elif score <= -0.3:
            title  = "Macro-aligned bearish"
            reason = f"Deeply negative score ({score:.3f}). Headwinds severe."
            action = "Don't catch the knife. Pullback to VWAP/resistance = short."
        else:
            title  = "Mixed context"
            reason = f"Score weak ({score:.3f}). Signals cancel out."
            action = "Wait for 15-min range breakout. No directional bias."

    return {
        **quant_data,
        "playbook_title":     title,
        "playbook_reasoning": reason,
        "playbook_action":    action,
        "session": {
            "label":    session_label,
            "ist_time": f"{ist_str} IST",
        },
        "metrics": {
            "volatility":      volatility,
            "theta_risk":      theta,
            "favorability":    favor,
            "structure":       structure,
            "conviction":      conviction,
            "grade":           grade,
            "warning":         " ".join(warnings) if warnings else None,
            "alignment":       alignment,
            "bullish_signals": bull_s,
            "bearish_signals": bear_s,
            "total_signals":   bull_s + bear_s,
            "alignment_delta": delta,
        },
    }
