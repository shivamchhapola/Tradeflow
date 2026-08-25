"""
Tradeflow Engine — LLM Trade Report Generator

Generates contextual post-trade reports via the configured LLM provider
(Ollama local or Groq cloud). Provider selection is read from settings.json
at call time — no restart needed to switch.
"""

import re
import logging
from typing import Optional
import json
from datetime import datetime, timezone

from sqlmodel import Session, select, col, func
from models import PaperTrade, PremarketLog, UserStat
from trades.paper import bump_activity_streak
from database import _award_badge
from llm.provider import get_llm_provider

logger = logging.getLogger(__name__)

VALID_VERDICTS = {"EXCELLENT", "GOOD", "NEEDS_WORK"}

def _strip_think(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()

def _extract_structured_tokens(text: str) -> tuple[str, Optional[int], Optional[str]]:
    thesis_score: Optional[int] = None
    process_verdict: Optional[str] = None

    score_match = re.search(r"THESIS_SCORE:\s*(\d{1,2})/10", text, re.IGNORECASE)
    if score_match:
        val = int(score_match.group(1))
        if 1 <= val <= 10:
            thesis_score = val
        text = text[:score_match.start()] + text[score_match.end():]

    verdict_match = re.search(
        r"PROCESS_VERDICT:\s*(EXCELLENT|GOOD|NEEDS_WORK)", text, re.IGNORECASE
    )
    if verdict_match:
        process_verdict = verdict_match.group(1).upper()
        text = text[:verdict_match.start()] + text[verdict_match.end():]

    clean = text.strip()
    return clean, thesis_score, process_verdict


def generate_report(trade: PaperTrade, premarket: PremarketLog | None) -> tuple[str, Optional[int], Optional[str]]:
    provider = get_llm_provider()
    persona = getattr(provider, "_persona", "supportive")

    if persona == "strict":
        persona_intro = "You are a strict, no-nonsense risk manager and trading mentor reviewing a paper trade. Be direct and uncompromising on risk management violations, thesis discipline, and market alignment."
    elif persona == "educator":
        persona_intro = "You are an analytical textbook trading instructor. Focus deeply on options mechanics, Greeks (delta, theta, IV), market structure, and technical setups."
    else:
        persona_intro = "You are an encouraging, supportive trading mentor reviewing a paper trade made by a student learning F&O (Futures & Options) on the Indian stock market (NSE/NIFTY)."

    metrics = {}
    pm_score = 'N/A'
    pm_bias = 'N/A'
    if premarket:
        pm_score = premarket.score
        pm_bias = premarket.bias
        if premarket.metrics:
            metrics = json.loads(premarket.metrics)

    has_thesis = bool(trade.thesis.strip() if trade.thesis else "")
    thesis_text = trade.thesis or "Not provided — student did not write a thesis before entering."

    prompt = f"""{persona_intro}

PRE-MARKET CONTEXT (what was known before the trade):
- Bias score: {pm_score}
- Market bias: {pm_bias}
- Grade: {metrics.get('grade', 'N/A')}
- Conviction: {metrics.get('conviction', 'N/A')}
- Structure: {metrics.get('structure', 'N/A')}
- Volatility: {metrics.get('volatility', 'N/A')}
- Warning: {metrics.get('warning', 'None')}

THE TRADE:
- Instrument: {trade.instrument}
- Direction: {trade.direction}
- Entry: ₹{trade.entry_price} at {trade.opened_at}
- Exit: ₹{trade.exit_price or 'still open'} at {trade.closed_at or 'N/A'}
- Stop loss was: ₹{trade.stop_loss}
- Target was: ₹{trade.target}
- Exit reason: {trade.exit_reason or 'N/A'}
- P&L: ₹{trade.pnl or 'N/A'}
- Student's thesis: {thesis_text}

Write a trade report with exactly these 5 sections:

1. **What happened** — 2-3 factual sentences about the trade and market context

2. **Where it went right or wrong** — Be specific. Reference the pre-market context. Was the thesis aligned with conditions? Did the direction match the macro bias?

3. **What the textbook says** — Explain the relevant FnO concept (theta decay, IV, spread strategy, timing, delta, etc.) tied specifically to THIS setup

4. **Verdict** — Was this a good PROCESS trade despite the outcome, or a bad process trade that got lucky/unlucky? Process = thesis quality, entry timing, SL/target rationale, alignment with pre-market bias

5. **One thing to watch next time** — Single, specific, actionable sentence

Rules:
- Keep prose under 350 words total
- Be honest but encouraging — this person is learning
- Focus on PROCESS quality, not P&L outcome
- Use Indian market context (NIFTY, NSE, IST timings)
{"- The thesis was provided — specifically evaluate whether it aligned with the pre-market conditions and whether the trade honored the thesis logic." if has_thesis else "- The thesis was NOT provided — note that writing a thesis before entering helps clarify thinking, and deduct from the alignment score accordingly."}
- Do NOT include any preamble or reasoning — output the 5 sections only, then the two tokens below

After the 5 sections, on separate lines, output these two machine-readable tokens (required):
THESIS_SCORE: N/10
PROCESS_VERDICT: EXCELLENT or GOOD or NEEDS_WORK

Scoring guidance:
- THESIS_SCORE: Rate how well the student's thesis matched pre-market conditions and actual outcome. 1=completely misaligned, 10=perfectly aligned.
- PROCESS_VERDICT: EXCELLENT = thesis + SL respected + aligned with macro; GOOD = some discipline shown; NEEDS_WORK = no thesis, or ignored pre-market bias, or poor SL placement"""

    provider = get_llm_provider()
    logger.info("Generating report via %s (%s)", provider.provider_name, provider.model_name)
    raw = provider.generate(prompt)

    stripped = _strip_think(raw)
    report, thesis_score, process_verdict = _extract_structured_tokens(stripped)

    return report, thesis_score, process_verdict


def save_report(session: Session, trade_id: int, user_id: int, report: str,
                thesis_score: Optional[int] = None,
                process_verdict: Optional[str] = None):
    trade = session.exec(
        select(PaperTrade)
        .where(PaperTrade.id == trade_id)
        .where(PaperTrade.user_id == user_id)
    ).first()
    
    if not trade:
        logger.warning("save_report called for missing trade %d / user %d — skipping", trade_id, user_id)
        return

    trade.report = report
    trade.thesis_score = thesis_score
    trade.process_verdict = process_verdict
    session.add(trade)
        
    stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    if stats:
        stats.total_xp += 10
        session.add(stats)

    session.flush()
    
    now_iso = datetime.now(timezone.utc).isoformat()
    _award_badge(session, user_id, "first_report", now_iso)
    
    read_reports_count = session.exec(
        select(func.count(col(PaperTrade.id)))
        .where(PaperTrade.user_id == user_id, PaperTrade.report != None, PaperTrade.report != "")
    ).first() or 0
    if read_reports_count >= 10:
        _award_badge(session, user_id, "student", now_iso)

    bump_activity_streak(session, user_id)
    session.commit()
