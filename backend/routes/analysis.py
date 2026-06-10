import json
from datetime import datetime, timedelta
import pytz
from typing import Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select, col

from database import get_db
from models import PremarketLog, User
from schemas import AnalysisResponse
from engine.scoring import generate_quant_data
from engine.playbook import generate_playbook
from engine.premarket_candles import build_preopen_daily_candles
from auth.dependencies import get_current_user_optional

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])

@router.get("", response_model=AnalysisResponse)
def get_analysis(
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_db)
):
    """Get the analysis for today from DB, or generate if missing."""
    ist_now = datetime.now(pytz.timezone("Asia/Kolkata"))
    is_market_hours = (
        ist_now.weekday() < 5 and
        (ist_now.hour > 8 or (ist_now.hour == 8 and ist_now.minute >= 0)) and
        (ist_now.hour < 15 or (ist_now.hour == 15 and ist_now.minute < 30))
    )

    today_ist = ist_now.strftime("%Y-%m-%d")
    row = session.exec(
        select(PremarketLog)
        .where(PremarketLog.date == today_ist)
        .order_by(col(PremarketLog.run_at).desc())
    ).first()

    if row:
        run_dt = datetime.fromisoformat(row.run_at)
        # Only auto-fetch if we are within market hours and data is > 5 mins old
        if is_market_hours and ((ist_now - run_dt).total_seconds() > 300 or not row.playbook_title):
            result = _run_analysis_inner(session)
            result["auto_fetch"] = True
            return result

        return {
            "final_bias_score": row.score,
            "market_bias":      row.bias,
            "metrics":          json.loads(row.metrics) if row.metrics else {},
            "market_data":      json.loads(row.market_data) if row.market_data else [],
            "analysis_time":    row.run_at,
            "playbook_title":   row.playbook_title,
            "playbook_reasoning": row.playbook_reasoning,
            "playbook_action":  row.playbook_action,
            "session":          json.loads(row.session) if row.session else {},
            "auto_fetch":       is_market_hours
        }

    # If no row exists at all for today, we MUST run it at least once.
    result = _run_analysis_inner(session)
    result["auto_fetch"] = is_market_hours
    return result


@router.post("/run", response_model=AnalysisResponse)
def run_analysis(
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: Session = Depends(get_db)
):
    """Trigger a fresh pre-market analysis."""
    result = _run_analysis_inner(session)
    result["auto_fetch"] = False
    return result


def _run_analysis_inner(session: Session) -> dict:
    """Run the analysis and persist a snapshot."""
    quant = generate_quant_data()
    result = generate_playbook(quant)

    today = datetime.now(pytz.timezone("Asia/Kolkata")).strftime("%Y-%m-%d")
    new_log = PremarketLog(
        date=today,
        run_at=datetime.now(pytz.timezone("Asia/Kolkata")).isoformat(),
        score=result["final_bias_score"],
        bias=result["market_bias"],
        grade=result["metrics"]["grade"],
        metrics=json.dumps(result["metrics"]),
        market_data=json.dumps(result["market_data"]),
        playbook_title=result.get("playbook_title"),
        playbook_reasoning=result.get("playbook_reasoning"),
        playbook_action=result.get("playbook_action"),
        session=json.dumps(result.get("session", {})),
    )
    session.add(new_log)
    session.commit()

    return result


@router.get("/history")
def analysis_history(days: int = 7, session: Session = Depends(get_db)):
    """Raw premarket log rows for the last `days` calendar days (all run times)."""
    days = max(1, min(days, 90))
    fetch_span = max(days, 1)
    ist = pytz.timezone("Asia/Kolkata")
    start_date = (datetime.now(ist).date() - timedelta(days=fetch_span)).isoformat()
    
    rows = session.exec(
        select(PremarketLog)
        .where(PremarketLog.date >= start_date)
        .order_by(col(PremarketLog.date).desc(), col(PremarketLog.run_at).asc())
    ).all()

    return [
        {
            "id":    r.id,
            "date":  r.date,
            "run_at": r.run_at,
            "score": r.score,
            "bias":  r.bias,
            "grade": r.grade,
        }
        for r in rows
    ]


@router.get("/history-candles")
def analysis_history_candles(days: int = 5, session: Session = Depends(get_db)):
    """
    Daily OHLC for the macro score, grouped by premarket_logs.date.
    """
    days = max(1, min(days, 30))
    fetch_span = max(days + 14, 21)
    ist = pytz.timezone("Asia/Kolkata")
    start_date = (datetime.now(ist).date() - timedelta(days=fetch_span)).isoformat()
    
    rows = session.exec(
        select(PremarketLog)
        .where(PremarketLog.date >= start_date)
        .order_by(col(PremarketLog.date).asc(), col(PremarketLog.run_at).asc())
    ).all()
    
    row_dicts = [
        {"date": r.date, "run_at": r.run_at, "score": r.score, "bias": r.bias}
        for r in rows
    ]
    return build_preopen_daily_candles(row_dicts, num_days=days)
