"""
Tradeflow Engine — Paper Trade CRUD

Handles opening, closing, and querying paper trades.
XP is awarded for process (setting SL, writing thesis), not profit.
"""

from datetime import date, datetime, timedelta
from sqlmodel import Session, select, col, func
from models import PaperTrade, UserStat
from database import _award_badge
from engine.quest_phases import now_ist

XP_RULES = {
    "logged_trade":   10,
    "set_stop_loss":  20,
    "wrote_thesis":   15,
    "read_report":    10,
    "revenge_trade": -25,
}

REVENGE_COOLDOWN_SECONDS = 300

def _ensure_user_stats(session: Session, user_id: int) -> None:
    """Idempotently insert a user_stats row for `user_id`."""
    exists = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    if not exists:
        session.add(UserStat(user_id=user_id))

def _previous_trading_day(d: date) -> date:
    prev = d - timedelta(days=1)
    while prev.weekday() >= 5:  # Sat=5, Sun=6
        prev -= timedelta(days=1)
    return prev

def bump_activity_streak(session: Session, user_id: int) -> None:
    ist_now = now_ist()
    today = ist_now.date()
    is_weekend = today.weekday() >= 5

    stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    if not stats:
        _ensure_user_stats(session, user_id)
        stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    
    assert stats is not None

    last_streak_day = (
        date.fromisoformat(stats.last_streak_day) if stats.last_streak_day else None
    )

    if is_weekend:
        stats.last_active = ist_now.isoformat()
        session.add(stats)
        return

    if last_streak_day == today:
        stats.last_active = ist_now.isoformat()
        session.add(stats)
        return

    if last_streak_day == _previous_trading_day(today):
        stats.streak_days += 1
    else:
        stats.streak_days = 1

    stats.last_streak_day = today.isoformat()
    stats.last_active = ist_now.isoformat()
    
    if stats.streak_days >= 5:
        _award_badge(session, user_id, "consistent", ist_now.isoformat())
        
    session.add(stats)

def open_trade(
    session: Session,
    user_id: int,
    instrument: str,
    direction: str,
    quantity: int,
    entry_price: float,
    stop_loss: float,
    target: float,
    thesis: str | None = None,
    premarket_id: int | None = None,
) -> int:
    """Open a new paper trade for `user_id`. Returns the trade ID."""
    now = now_ist().isoformat()
    _ensure_user_stats(session, user_id)

    xp = XP_RULES["logged_trade"] + XP_RULES["set_stop_loss"]
    if thesis:
        xp += XP_RULES["wrote_thesis"]

    recent_loss = session.exec(
        select(PaperTrade)
        .where(PaperTrade.user_id == user_id)
        .where(col(PaperTrade.pnl) < 0)
        .where(PaperTrade.closed_at != None)
        .order_by(col(PaperTrade.closed_at).desc())
    ).first()

    if recent_loss and recent_loss.closed_at:
        closed_time = datetime.fromisoformat(recent_loss.closed_at)
        current_time = now_ist()
        # Legacy data may be naive (pre-IST fix) — assume IST for comparison
        if closed_time.tzinfo is None:
            closed_time = closed_time.replace(tzinfo=current_time.tzinfo)
        if (current_time - closed_time).total_seconds() < REVENGE_COOLDOWN_SECONDS:
            xp += XP_RULES["revenge_trade"]

    final_xp = max(xp, 0)
    
    trade = PaperTrade(
        user_id=user_id,
        opened_at=now,
        instrument=instrument,
        direction=direction,
        quantity=quantity,
        entry_price=entry_price,
        stop_loss=stop_loss,
        target=target,
        thesis=thesis,
        premarket_id=premarket_id,
        xp_earned=final_xp,
    )
    session.add(trade)

    stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    if stats:
        stats.total_xp += final_xp
        session.add(stats)

    bump_activity_streak(session, user_id)
    
    if thesis:
        _award_badge(session, user_id, "first_thesis", now)
        
    session.commit()
    session.refresh(trade)

    assert trade.id is not None
    return trade.id

def close_trade(
    session: Session,
    user_id: int,
    trade_id: int,
    exit_price: float,
    exit_reason: str,
) -> float | None:
    """Close `trade_id` belonging to `user_id`. Returns P&L or None if not found."""
    trade = session.exec(
        select(PaperTrade)
        .where(PaperTrade.id == trade_id)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at == None)
    ).first()

    if not trade:
        return None

    pnl = (exit_price - trade.entry_price) * trade.quantity
    if trade.direction == "SELL":
        pnl = -pnl

    pnl = round(pnl, 2)

    trade.closed_at = now_ist().isoformat()
    trade.exit_price = exit_price
    trade.exit_reason = exit_reason
    trade.pnl = pnl
    session.add(trade)

    stats = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    if stats:
        stats.virtual_balance += pnl
        session.add(stats)

    if exit_reason != "auto_squareoff":
        bump_activity_streak(session, user_id)
        
    session.flush()
    if exit_reason == "stop_hit":
        _award_badge(session, user_id, "stop_respected", trade.closed_at)
        stopped_count = session.exec(
            select(func.count(col(PaperTrade.id)))
            .where(PaperTrade.user_id == user_id, PaperTrade.exit_reason == "stop_hit")
        ).first() or 0
        if stopped_count >= 10:
            _award_badge(session, user_id, "disciplined", trade.closed_at)
            
    last_20 = session.exec(select(PaperTrade).where(PaperTrade.user_id == user_id).order_by(col(PaperTrade.id).desc()).limit(20)).all()
    if len(last_20) == 20 and all(t.thesis and t.thesis.strip() for t in last_20):
        _award_badge(session, user_id, "thesis_trader", trade.closed_at)
        
    session.commit()
    return pnl

def get_open_trades(session: Session, user_id: int) -> list[PaperTrade]:
    return list(session.exec(
        select(PaperTrade)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at == None)
        .order_by(col(PaperTrade.opened_at).desc())
    ).all())

def get_trade_history(session: Session, user_id: int, limit: int = 50, offset: int = 0) -> list[PaperTrade]:
    return list(session.exec(
        select(PaperTrade)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at != None)
        .order_by(col(PaperTrade.closed_at).desc())
        .limit(limit)
        .offset(offset)
    ).all())

def get_stats(session: Session, user_id: int) -> dict:
    _ensure_user_stats(session, user_id)
    stats_row = session.exec(select(UserStat).where(UserStat.user_id == user_id)).first()
    stats = {
        "total_xp": stats_row.total_xp if stats_row else 0,
        "streak_days": stats_row.streak_days if stats_row else 0,
        "last_active": stats_row.last_active if stats_row else None,
        "virtual_balance": stats_row.virtual_balance if stats_row else 500000.0,
    }

    closed_trades = session.exec(
        select(PaperTrade.pnl)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at != None)
    ).all()

    pnls = [pnl for pnl in closed_trades if pnl is not None]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]

    stats["total_trades"] = len(pnls)
    stats["win_rate"]     = round(len(wins) / len(pnls) * 100, 1) if pnls else 0
    stats["avg_win"]      = round(sum(wins) / len(wins), 2) if wins else 0
    stats["avg_loss"]     = round(sum(losses) / len(losses), 2) if losses else 0
    stats["total_pnl"]    = round(sum(pnls), 2)
    stats["max_drawdown"] = _compute_max_drawdown(pnls)

    return stats

def _compute_max_drawdown(pnls: list[float]) -> float:
    if not pnls:
        return 0
    cumulative = 0
    peak = 0
    max_dd = 0
    for pnl in pnls:
        cumulative += pnl
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > max_dd:
            max_dd = dd
    return round(max_dd, 2)
