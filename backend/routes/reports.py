import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_db
from models import User, PaperTrade, PremarketLog
from schemas import ReportResponse, StatsResponse
from auth.dependencies import get_current_user
from trades.report import generate_report, save_report
from trades.paper import get_stats

router = APIRouter(prefix="/api", tags=["Reports & Stats"])

@router.post("/trades/{trade_id}/report", response_model=ReportResponse)
def generate_trade_report(
    trade_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Generate an LLM-powered post-trade report."""
    trade = session.exec(
        select(PaperTrade)
        .where(PaperTrade.id == trade_id)
        .where(PaperTrade.user_id == current_user.id)
    ).first()

    if not trade:
        raise HTTPException(404, "Trade not found")

    if trade.report:
        return {
            "report": trade.report,
            "thesis_score": trade.thesis_score,
            "process_verdict": trade.process_verdict,
            "cached": True,
        }

    pm = None
    if trade.premarket_id:
        pm = session.exec(select(PremarketLog).where(PremarketLog.id == trade.premarket_id)).first()

    logger = logging.getLogger("reports.generate")
    logger.info(f"Received request to generate report for trade_id: {trade_id}")
    try:
        report, thesis_score, process_verdict = generate_report(trade, pm)
        logger.info("Successfully generated report text.")
        assert current_user.id is not None
        save_report(session, trade_id, current_user.id, report, thesis_score, process_verdict)
        logger.info("Successfully saved report to database.")
        return {
            "report": report,
            "thesis_score": thesis_score,
            "process_verdict": process_verdict,
            "cached": False,
        }
    except ValueError as e:
        logger.error(f"ValueError during report generation: {e}", exc_info=True)
        raise HTTPException(500, str(e))
    except Exception as e:
        logger.error(f"Exception during report generation: {e}", exc_info=True)
        raise HTTPException(502, f"LLM API error: {e}")


@router.get("/stats", response_model=StatsResponse)
def user_stats_endpoint(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get user stats: XP, balance, win rate, streaks, etc."""
    assert current_user.id is not None
    return get_stats(session, current_user.id)
