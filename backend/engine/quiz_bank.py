"""
Tradeflow — Quiz Bank

Categorised question bank used by the daily quest system. Selection is
deterministic per (date, phase) so refreshes don't re-roll within the day.

Each entry shape:
    {
        "id":          str,    # stable e.g. "macro.pcr.basic"
        "category":    str,    # one of CATEGORIES
        "difficulty":  int,    # 1 (easy) .. 3 (hard)
        "question":    str,
        "options":     list[str],
        "correct":     str,    # must be one of options
        "explanation": str,    # shown after the user answers
    }

Phase 2 hook
------------
`select_questions(date, phase, user_id)` is the single integration point.
Swap it out to call Ollama with the user's recent trades + mentor reports to
generate personalised questions, without touching the API surface.
"""

from __future__ import annotations

import hashlib
import random
from typing import Iterable

# ── Constants ────────────────────────────────────────────────────────────────

QUESTIONS_PER_QUEST = 3

CATEGORIES = (
    "candles",
    "greeks",
    "strategies",
    "risk",
    "macro",
    "pre_market",
    "psychology",
    "nse_specifics",
)

# Per-phase category weighting. Higher = more likely to be drawn.
# Any category not listed for a phase still has a base weight of 1.
PHASE_CATEGORY_BIAS: dict[str, dict[str, int]] = {
    "early":         {"macro": 4, "pre_market": 4, "candles": 3},
    "premarket":     {"macro": 4, "pre_market": 4, "candles": 3},
    "intraday":      {"risk": 4, "psychology": 3, "candles": 3, "greeks": 2},
    "postmarket":    {"psychology": 4, "risk": 4, "strategies": 3},
    "weekend":       {"strategies": 4, "greeks": 4, "nse_specifics": 3},
    "quiz_backlog":  {"strategies": 2, "macro": 2, "risk": 2},
    "pending_reports": {"psychology": 2, "risk": 2},
}


# ── The bank ─────────────────────────────────────────────────────────────────

QUIZ_BANK: list[dict] = [
    # ── candles ────────────────────────────────────────────────────────────
    {
        "id": "candles.hammer.basic",
        "category": "candles",
        "difficulty": 1,
        "question": "Which candle pattern signals a strong bullish reversal after a downtrend?",
        "options": ["Doji", "Hammer", "Shooting Star", "Bearish Engulfing"],
        "correct": "Hammer",
        "explanation": "A Hammer has a long lower wick showing buyers absorbed selling — classic reversal signal at a support level.",
    },
    {
        "id": "candles.doji.meaning",
        "category": "candles",
        "difficulty": 1,
        "question": "A Doji candle primarily indicates what?",
        "options": [
            "A strong trending move",
            "Indecision — open and close are nearly equal",
            "A guaranteed reversal",
            "High implied volatility",
        ],
        "correct": "Indecision — open and close are nearly equal",
        "explanation": "A Doji shows neither side won the session. Its meaning depends on context: at a trend extreme it can hint at exhaustion, in chop it's just noise.",
    },
    {
        "id": "candles.bullish_engulfing",
        "category": "candles",
        "difficulty": 2,
        "question": "A Bullish Engulfing pattern at a key support level usually signals what?",
        "options": [
            "Continuation of the downtrend",
            "Potential reversal — buyers overwhelmed sellers in one session",
            "An imminent gap down",
            "Time to short aggressively",
        ],
        "correct": "Potential reversal — buyers overwhelmed sellers in one session",
        "explanation": "A larger green candle that fully engulfs the prior red candle at support shows demand absorbed all the supply. Highest probability when volume confirms.",
    },
    {
        "id": "candles.shooting_star",
        "category": "candles",
        "difficulty": 2,
        "question": "A Shooting Star at the top of an uptrend warns of what?",
        "options": [
            "Trend continuation",
            "Potential bearish reversal — buyers failed to hold the highs",
            "A bullish breakout",
            "Nothing — wicks are random",
        ],
        "correct": "Potential bearish reversal — buyers failed to hold the highs",
        "explanation": "Long upper wick + small body near the low of the session = sellers rejected higher prices. Strongest signal when it forms at prior resistance.",
    },
    {
        "id": "candles.marubozu",
        "category": "candles",
        "difficulty": 2,
        "question": "A green Marubozu (no wicks) candle suggests what?",
        "options": [
            "Indecision",
            "Strong conviction — buyers controlled the entire session",
            "An impending reversal",
            "Liquidity dried up",
        ],
        "correct": "Strong conviction — buyers controlled the entire session",
        "explanation": "Open = low and close = high means no seller pressure at any point. Often signals trend continuation if it appears mid-trend.",
    },

    # ── greeks ─────────────────────────────────────────────────────────────
    {
        "id": "greeks.theta.expiry",
        "category": "greeks",
        "difficulty": 1,
        "question": "Theta decay accelerates most strongly near what?",
        "options": ["Expiry day", "Earnings announcements", "High VIX periods", "Index rebalancing"],
        "correct": "Expiry day",
        "explanation": "Theta is non-linear — it accelerates sharply in the final days before expiry. This is why weekly expiry day is both high opportunity and high risk for option buyers.",
    },
    {
        "id": "greeks.delta.atm",
        "category": "greeks",
        "difficulty": 1,
        "question": "An at-the-money call option typically has a delta near what value?",
        "options": ["0.1", "0.5", "0.9", "1.0"],
        "correct": "0.5",
        "explanation": "ATM options have ~0.50 delta — a ₹1 move in the underlying changes the option price by ~₹0.50. ITM trends to 1.0, OTM trends to 0.",
    },
    {
        "id": "greeks.vega.iv",
        "category": "greeks",
        "difficulty": 2,
        "question": "If IV doubles overnight with no price move, what happens to your long call?",
        "options": [
            "Loses value because of theta",
            "Gains value because vega is positive for buyers",
            "Stays exactly the same",
            "Becomes worthless",
        ],
        "correct": "Gains value because vega is positive for buyers",
        "explanation": "Vega measures sensitivity to IV. Buyers benefit from IV expansion, sellers get hurt. This is why event-day buying can pay even on flat moves.",
    },
    {
        "id": "greeks.gamma.expiry",
        "category": "greeks",
        "difficulty": 3,
        "question": "Why is gamma risk highest on expiry day?",
        "options": [
            "Theta becomes zero",
            "Delta swings rapidly between 0 and 1 as price crosses the strike",
            "IV always crashes on expiry",
            "Liquidity is infinite",
        ],
        "correct": "Delta swings rapidly between 0 and 1 as price crosses the strike",
        "explanation": "Near expiry, even a small spot move flips an option from OTM to ITM and back. Short option sellers get whipsawed — this is the famous 'gamma risk'.",
    },
    {
        "id": "greeks.theta.sellers",
        "category": "greeks",
        "difficulty": 2,
        "question": "Who benefits most from theta decay?",
        "options": ["Option buyers", "Option sellers / writers", "Equity holders", "Futures traders"],
        "correct": "Option sellers / writers",
        "explanation": "Each passing day, theta erodes option premium. Sellers collected that premium upfront and pocket the decay if the underlying behaves.",
    },

    # ── strategies ─────────────────────────────────────────────────────────
    {
        "id": "strategies.iron_condor.max_profit",
        "category": "strategies",
        "difficulty": 2,
        "question": "In an Iron Condor, what is the maximum profit scenario?",
        "options": [
            "Underlying makes a big move in either direction",
            "Underlying stays between both short strikes at expiry",
            "IV expands sharply",
            "You close early at a loss",
        ],
        "correct": "Underlying stays between both short strikes at expiry",
        "explanation": "You collect net premium upfront. Max profit is that full credit if the underlying expires in the range you sold.",
    },
    {
        "id": "strategies.straddle.when",
        "category": "strategies",
        "difficulty": 2,
        "question": "A long straddle is best suited for what view?",
        "options": [
            "Bullish on direction, certain it will rise",
            "Expecting a large move, unsure of direction",
            "Expecting low volatility",
            "Wanting to collect theta",
        ],
        "correct": "Expecting a large move, unsure of direction",
        "explanation": "Buying ATM call + ATM put profits from a big move either way. The catch: you need a move bigger than the combined premium paid, and IV crush after the event can hurt.",
    },
    {
        "id": "strategies.bull_call_spread",
        "category": "strategies",
        "difficulty": 2,
        "question": "Why use a Bull Call Spread instead of a naked long call?",
        "options": [
            "Higher unlimited profit potential",
            "Lower cost and defined max loss — sells a higher strike to fund the buy",
            "Better for IV expansion plays",
            "It always wins on theta",
        ],
        "correct": "Lower cost and defined max loss — sells a higher strike to fund the buy",
        "explanation": "Spread caps both your cost and your max profit. Useful when you have a moderate directional view and don't want to pay full premium.",
    },
    {
        "id": "strategies.short_strangle.risk",
        "category": "strategies",
        "difficulty": 3,
        "question": "What is the primary risk of a short strangle?",
        "options": [
            "Unlimited theoretical loss if the underlying moves sharply",
            "Limited loss capped at premium received",
            "Only IV expansion",
            "Only theta decay",
        ],
        "correct": "Unlimited theoretical loss if the underlying moves sharply",
        "explanation": "You're short an OTM call AND an OTM put. A sharp move either way puts one leg deep ITM with no cap. Margin requirements reflect this risk.",
    },
    {
        "id": "strategies.calendar_spread",
        "category": "strategies",
        "difficulty": 3,
        "question": "A calendar spread (sell front-month, buy back-month) primarily profits from?",
        "options": [
            "Strong directional moves",
            "Front-month theta decaying faster than back-month",
            "IV crush in the back-month",
            "Gap downs",
        ],
        "correct": "Front-month theta decaying faster than back-month",
        "explanation": "Near-term options decay faster than longer-dated ones. The strategy collects this differential decay as long as the underlying stays near the strike.",
    },

    # ── risk ───────────────────────────────────────────────────────────────
    {
        "id": "risk.sl.discipline",
        "category": "risk",
        "difficulty": 1,
        "question": "Why is a stop loss mandatory before entering any trade?",
        "options": [
            "It guarantees you make money",
            "It defines max loss and removes the emotional 'maybe it bounces' moment",
            "Brokers require it by law",
            "It increases your win rate",
        ],
        "correct": "It defines max loss and removes the emotional 'maybe it bounces' moment",
        "explanation": "Pre-defining your exit removes the worst trading decision — letting losses run hoping for a reversal. SL turns risk into a known number.",
    },
    {
        "id": "risk.position_sizing",
        "category": "risk",
        "difficulty": 2,
        "question": "A common rule of thumb for max risk per trade is what percentage of capital?",
        "options": ["10%", "5%", "1–2%", "0.1%"],
        "correct": "1–2%",
        "explanation": "Risking 1–2% per trade means even a 10-trade losing streak only draws down ~10–20%. Bigger sizes ruin accounts before any edge plays out.",
    },
    {
        "id": "risk.rr.ratio",
        "category": "risk",
        "difficulty": 2,
        "question": "What's the minimum Risk:Reward ratio many disciplined traders accept?",
        "options": ["1:0.5", "1:1", "1:2", "1:10"],
        "correct": "1:2",
        "explanation": "With 1:2, a 40% win rate still breaks even. Below 1:1, you need to win way more than half the time to stay profitable — most people don't.",
    },
    {
        "id": "risk.revenge.cooldown",
        "category": "risk",
        "difficulty": 2,
        "question": "After taking a loss, why is a 5-minute cooldown before the next trade enforced?",
        "options": [
            "Brokers throttle order entry",
            "To avoid revenge trades driven by emotion rather than setup",
            "To let the option chain refresh",
            "It's only superstition",
        ],
        "correct": "To avoid revenge trades driven by emotion rather than setup",
        "explanation": "The brain right after a loss is biased toward 'win it back'. A cooldown forces re-evaluation against the original playbook instead of emotion.",
    },
    {
        "id": "risk.naked_short.overnight",
        "category": "risk",
        "difficulty": 3,
        "question": "What is the primary risk of holding a naked short option overnight?",
        "options": [
            "Time decay works against you",
            "Gap risk — underlying can open far outside your strike",
            "Delta becomes zero",
            "You lose your margin automatically",
        ],
        "correct": "Gap risk — underlying can open far outside your strike",
        "explanation": "Overnight gaps from global events can blow past your strike before you can react. This is why most pro traders hedge short options.",
    },

    # ── macro ──────────────────────────────────────────────────────────────
    {
        "id": "macro.pcr.basic",
        "category": "macro",
        "difficulty": 2,
        "question": "PCR (Put-Call Ratio) > 1.2 generally suggests what about market sentiment?",
        "options": [
            "Strong bullish momentum",
            "Heavy put buying — bearish tilt or fear in the market",
            "Options market is thin",
            "Call writers are exiting",
        ],
        "correct": "Heavy put buying — bearish tilt or fear in the market",
        "explanation": "More puts being bought/sold than calls suggests hedging or bearish positioning. A contrarian view is that extreme PCR > 1.5 can signal a reversal.",
    },
    {
        "id": "macro.vix.spike",
        "category": "macro",
        "difficulty": 2,
        "question": "What does a VIX spike above 20 typically indicate for NIFTY options?",
        "options": [
            "Options are cheap, good time to buy",
            "Options are expensive — premium sellers benefit",
            "Market is unambiguously bullish",
            "IV will stay elevated forever",
        ],
        "correct": "Options are expensive — premium sellers benefit",
        "explanation": "High VIX inflates IV. Buyers pay more; sellers collect fatter premiums. Timing IV entry matters as much as direction.",
    },
    {
        "id": "macro.oi_buildup_ce",
        "category": "macro",
        "difficulty": 3,
        "question": "A high OI buildup at the 22500 CE strike suggests what?",
        "options": [
            "Market expects 22500 to be broken easily",
            "Call writers expect 22500 to act as resistance this expiry",
            "Buyers are aggressively buying calls",
            "Puts are being written at 22500",
        ],
        "correct": "Call writers expect 22500 to act as resistance this expiry",
        "explanation": "Large CE OI at a level means many call sellers have written there — they profit if NIFTY stays below. It acts as a gravity well / resistance.",
    },
    {
        "id": "macro.dxy.inverse",
        "category": "macro",
        "difficulty": 2,
        "question": "Why does a rising DXY (US dollar index) often pressure Indian equities?",
        "options": [
            "It strengthens the rupee",
            "FII outflows — capital moves to USD assets, weakening EM equities",
            "It boosts IT exports always",
            "It has zero effect",
        ],
        "correct": "FII outflows — capital moves to USD assets, weakening EM equities",
        "explanation": "Stronger USD makes EM holdings less attractive for foreign investors. They sell Indian equities to repatriate gains, dragging NIFTY down.",
    },
    {
        "id": "macro.us_10y_yields",
        "category": "macro",
        "difficulty": 3,
        "question": "Rising US 10Y bond yields typically signal what for risk assets?",
        "options": [
            "More risk appetite — buy aggressively",
            "Risk-off — equity valuations compress, funds rotate to bonds",
            "No effect on Indian markets",
            "Guaranteed NIFTY rally",
        ],
        "correct": "Risk-off — equity valuations compress, funds rotate to bonds",
        "explanation": "Higher yields raise the discount rate for future equity earnings (DCF math) and offer competing risk-free returns. Tech and high-growth stocks suffer most.",
    },

    # ── pre_market ─────────────────────────────────────────────────────────
    {
        "id": "pre_market.gift_nifty",
        "category": "pre_market",
        "difficulty": 1,
        "question": "Which global market is the most direct pre-market indicator for NIFTY 50?",
        "options": ["FTSE 100", "SGX NIFTY / GIFT NIFTY", "Nikkei 225", "S&P 500"],
        "correct": "SGX NIFTY / GIFT NIFTY",
        "explanation": "GIFT NIFTY trades ~22 hours/day and directly reflects global sentiment on Indian equities. It's the closest proxy for where NIFTY will open.",
    },
    {
        "id": "pre_market.global_sequence",
        "category": "pre_market",
        "difficulty": 2,
        "question": "In what order do global markets influence NIFTY's opening tone?",
        "options": [
            "US close → Asian open (Nikkei, Hang Seng) → SGX NIFTY → NIFTY 9:15 open",
            "NIFTY → US → Asia",
            "Only S&P 500 matters",
            "European markets dictate the tone",
        ],
        "correct": "US close → Asian open (Nikkei, Hang Seng) → SGX NIFTY → NIFTY 9:15 open",
        "explanation": "Sentiment travels West to East. US close sets overnight tone, Asia digests it from 5:30am IST, SGX NIFTY reflects the combined view, then NIFTY opens.",
    },
    {
        "id": "pre_market.gap_fade",
        "category": "pre_market",
        "difficulty": 3,
        "question": "What is a 'gap fade' setup?",
        "options": [
            "Buying every gap up immediately",
            "Trading the reversal when an opening gap fails to follow through",
            "Holding gaps overnight",
            "Closing trades before the gap",
        ],
        "correct": "Trading the reversal when an opening gap fails to follow through",
        "explanation": "When NIFTY gaps up but the first 15-min candle closes red (or vice versa), the gap often fades back toward the prior close. High-probability setup on weak-volume gaps.",
    },
    {
        "id": "pre_market.fake_out",
        "category": "pre_market",
        "difficulty": 3,
        "question": "GIFT NIFTY is strongly green but the global macro signals are bearish. What does this often signal?",
        "options": [
            "A high-conviction bullish day",
            "A possible 'fake-out' — gap up that fails as macros reassert",
            "Time to load up on calls",
            "Nothing actionable",
        ],
        "correct": "A possible 'fake-out' — gap up that fails as macros reassert",
        "explanation": "GIFT NIFTY can reflect short-term positioning while broader macros (DXY, crude, yields) signal the deeper bias. Misalignment often resolves toward the macros within the first hour.",
    },
    {
        "id": "pre_market.window",
        "category": "pre_market",
        "difficulty": 1,
        "question": "When does the official NSE pre-open session run?",
        "options": ["8:00–9:00 IST", "9:00–9:15 IST", "9:15–9:30 IST", "8:30–9:15 IST"],
        "correct": "9:00–9:15 IST",
        "explanation": "9:00–9:08 is order entry, 9:08–9:12 matches the opening price, 9:12–9:15 is buffer. Tradeflow's analysis runs at 8:00 to give you context before this window even starts.",
    },

    # ── psychology ─────────────────────────────────────────────────────────
    {
        "id": "psychology.fomo",
        "category": "psychology",
        "difficulty": 1,
        "question": "What is the FOMO trap most likely to make a trader do?",
        "options": [
            "Wait patiently for their setup",
            "Chase an extended move and enter at a poor price",
            "Reduce position size",
            "Take a break",
        ],
        "correct": "Chase an extended move and enter at a poor price",
        "explanation": "FOMO = Fear Of Missing Out. The move has already happened; entering late means buying tops or selling bottoms. The setup you waited for has passed.",
    },
    {
        "id": "psychology.process_vs_outcome",
        "category": "psychology",
        "difficulty": 2,
        "question": "Why does Tradeflow award XP for process (thesis, SL, reading reports) instead of P&L?",
        "options": [
            "P&L doesn't matter",
            "Good processes compound into a real edge over time; one trade's outcome is mostly noise",
            "To make trading harder",
            "Because P&L is too easy to measure",
        ],
        "correct": "Good processes compound into a real edge over time; one trade's outcome is mostly noise",
        "explanation": "A single trade is dominated by variance. A strict process — thesis, sized SL, post-trade review — is what separates traders who survive from those who don't.",
    },
    {
        "id": "psychology.tilt",
        "category": "psychology",
        "difficulty": 2,
        "question": "What does 'tilt' mean in trading psychology?",
        "options": [
            "A chart pattern",
            "Emotional decision-making after a string of losses (or wins) that breaks your rules",
            "A type of order",
            "Sector rotation",
        ],
        "correct": "Emotional decision-making after a string of losses (or wins) that breaks your rules",
        "explanation": "Tilt is the trading equivalent of poker tilt. The cure is mechanical: a hard daily loss limit, walking away, or shutting the terminal — no exceptions.",
    },
    {
        "id": "psychology.confirmation_bias",
        "category": "psychology",
        "difficulty": 3,
        "question": "Confirmation bias most often hurts traders by causing them to do what?",
        "options": [
            "Cut losses too quickly",
            "Only seek news / charts that support their existing position",
            "Trade with too little size",
            "Use too many indicators",
        ],
        "correct": "Only seek news / charts that support their existing position",
        "explanation": "Once you're in a trade, you start filtering for bullish stories (if long) and ignoring bearish signals. The fix: actively look for evidence you're wrong before adding to a position.",
    },
    {
        "id": "psychology.sit_out",
        "category": "psychology",
        "difficulty": 1,
        "question": "On a low-conviction day with no clear setup, the disciplined choice is what?",
        "options": [
            "Force a trade to stay engaged",
            "Sit out — capital preservation is itself a winning move",
            "Double position size to make it interesting",
            "Trade tiny lots randomly",
        ],
        "correct": "Sit out — capital preservation is itself a winning move",
        "explanation": "Not every day has a high-quality setup. Forcing trades on flat days bleeds capital and tilts you for when real opportunities arrive. Cash is a position.",
    },

    # ── nse_specifics ──────────────────────────────────────────────────────
    {
        "id": "nse.market_hours",
        "category": "nse_specifics",
        "difficulty": 1,
        "question": "What are the NSE equity & F&O trading hours (IST)?",
        "options": ["8:00 AM – 3:00 PM", "9:15 AM – 3:30 PM", "9:00 AM – 4:00 PM", "10:00 AM – 4:30 PM"],
        "correct": "9:15 AM – 3:30 PM",
        "explanation": "Weekdays only, including the pre-open 9:00–9:15. Tradeflow auto-squares-off paper trades at 3:15 PM to mimic broker intraday rules.",
    },
    {
        "id": "nse.nifty_lot_size",
        "category": "nse_specifics",
        "difficulty": 2,
        "question": "What is the current NIFTY lot size (verified May 2026)?",
        "options": ["25", "50", "65", "75"],
        "correct": "65",
        "explanation": "SEBI updates lot sizes periodically. As of May 2026 it's 65. Always verify at dhan.co/nse-fno-lot-size before hard-coding — incorrect lot size = incorrect P&L.",
    },
    {
        "id": "nse.banknifty_lot",
        "category": "nse_specifics",
        "difficulty": 2,
        "question": "What is the current Bank Nifty lot size (verified May 2026)?",
        "options": ["15", "25", "30", "40"],
        "correct": "30",
        "explanation": "Bank Nifty lot is 30 as of May 2026. Lot sizes change via SEBI circulars — always verify before sizing real trades.",
    },
    {
        "id": "nse.expiry_weekly",
        "category": "nse_specifics",
        "difficulty": 2,
        "question": "NIFTY weekly options expire on which day?",
        "options": ["Monday", "Wednesday", "Thursday", "Friday"],
        "correct": "Thursday",
        "explanation": "NIFTY weekly contracts expire every Thursday (or the previous trading day if Thursday is a holiday). Bank Nifty also expires Thursday after the 2024 consolidation.",
    },
    {
        "id": "nse.auto_squareoff",
        "category": "nse_specifics",
        "difficulty": 1,
        "question": "Why do brokers auto-square-off intraday positions before market close?",
        "options": [
            "Regulatory rule for intraday product types — positions can't carry to next day",
            "To collect more brokerage",
            "For tax reasons only",
            "It's optional",
        ],
        "correct": "Regulatory rule for intraday product types — positions can't carry to next day",
        "explanation": "Intraday products (MIS / equity intraday) get full leverage but must be squared off by end of day. Tradeflow mimics this at 3:15 PM IST.",
    },
    {
        "id": "nse.t_plus_one",
        "category": "nse_specifics",
        "difficulty": 3,
        "question": "What does India's T+1 settlement cycle mean?",
        "options": [
            "Trades settle two days after",
            "Equity trades settle one business day after the trade date",
            "Only F&O is settled this way",
            "Trades never settle",
        ],
        "correct": "Equity trades settle one business day after the trade date",
        "explanation": "Buy stock today (T), receive credit / pay debit on T+1. India was the first major market to fully roll out T+1, ahead of the US's transition.",
    },
    {
        "id": "nse.circuit_filter",
        "category": "nse_specifics",
        "difficulty": 2,
        "question": "What does a NIFTY 'circuit filter' (e.g. 10% / 15% / 20%) trigger?",
        "options": [
            "Faster order matching",
            "Trading halt for a defined period when the index moves beyond the threshold",
            "Extra leverage",
            "Compulsory buying",
        ],
        "correct": "Trading halt for a defined period when the index moves beyond the threshold",
        "explanation": "Circuit filters pause trading to let panic settle. 10% triggers 45-min halt, 15% triggers 1h 45m, 20% halts the rest of the day (depending on time hit).",
    },
]


# ── Selection ────────────────────────────────────────────────────────────────

def _deterministic_rng(date: str, phase: str, user_id: int | None) -> random.Random:
    """Stable RNG keyed by (date, phase, user). Same inputs → same questions."""
    key = f"{date}|{phase}|{user_id or 0}"
    seed = int(hashlib.sha256(key.encode()).hexdigest()[:16], 16)
    return random.Random(seed)


def _category_weight(phase: str, category: str) -> int:
    return PHASE_CATEGORY_BIAS.get(phase, {}).get(category, 1)


def select_questions(
    date: str,
    phase: str,
    user_id: int | None = None,
    count: int = QUESTIONS_PER_QUEST,
) -> list[dict]:
    """
    Pick `count` questions for the given (date, phase, user).

    Deterministic — same args produce the same set. Tries to diversify across
    categories: if possible, no two questions in the set share a category.

    Phase 2 hook
    ------------
    Swap this body to call Ollama with the user's recent closed trades + mentor
    reports to produce personalised questions, while keeping the same return
    shape and the same `correct` / `explanation` keys.
    """
    if count < 1:
        return []

    rng = _deterministic_rng(date, phase, user_id)

    # Build a weighted pool — repeat each question by its category weight
    # so heavier categories dominate the draw without removing the others.
    pool: list[dict] = []
    for q in QUIZ_BANK:
        weight = _category_weight(phase, q["category"])
        pool.extend([q] * max(1, weight))

    chosen: list[dict] = []
    chosen_ids: set[str] = set()
    chosen_categories: set[str] = set()

    # Pass 1: prefer category diversity
    attempts = 0
    max_attempts = 1000
    while len(chosen) < count and attempts < max_attempts:
        attempts += 1
        q = rng.choice(pool)
        if q["id"] in chosen_ids:
            continue
        if q["category"] in chosen_categories and len(chosen_categories) < len(CATEGORIES):
            # try to diversify — only allow category repeats once we've covered enough
            if len(chosen) < count - 1 and rng.random() < 0.6:
                continue
        chosen.append(q)
        chosen_ids.add(q["id"])
        chosen_categories.add(q["category"])

    # Pass 2: if we still need more (tiny bank, heavy weights), drop the diversity rule
    if len(chosen) < count:
        remaining = [q for q in QUIZ_BANK if q["id"] not in chosen_ids]
        rng.shuffle(remaining)
        for q in remaining:
            if len(chosen) >= count:
                break
            chosen.append(q)
            chosen_ids.add(q["id"])

    return chosen


def get_question_by_id(qid: str) -> dict | None:
    """Look up a question by its stable id. Used by the answer endpoint to
    validate the submitted answer without trusting the client's payload."""
    for q in QUIZ_BANK:
        if q["id"] == qid:
            return q
    return None


def public_view(question: dict) -> dict:
    """Strip `correct` and `explanation` before sending to the client."""
    return {
        "id": question["id"],
        "category": question["category"],
        "difficulty": question["difficulty"],
        "question": question["question"],
        "options": list(question["options"]),
    }


def public_views(questions: Iterable[dict]) -> list[dict]:
    return [public_view(q) for q in questions]
