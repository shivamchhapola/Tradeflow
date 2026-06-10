"""
Tradeflow — Catch-Up Auto Square-Off

Closes stale open paper trades when the user logs in after market hours.
Called from auth/routes.py on login and /me to handle cases where the
3:15 PM cron missed (server was down, user was offline, etc.).

Exit price = entry_price (P&L = ₹0) since we don't have live LTP
after hours. The real-time cron at 3:15 uses live NSE LTP.
"""

import logging
from datetime import date

from sqlmodel import Session, select

from engine.quest_phases import now_ist
from models import PaperTrade
from trades.paper import close_trade

logger = logging.getLogger(__name__)


def _should_squareoff_now() -> bool:
    """True if we're past the 15:15 IST auto-squareoff window on a weekday,
    or it's a weekend (any trades left open from Friday should close)."""
    ist_now = now_ist()

    # Weekend — any open trade from Friday (or earlier) is stale
    if ist_now.weekday() >= 5:
        return True

    # Weekday after 15:15 — squareoff window has passed
    minutes = ist_now.hour * 60 + ist_now.minute
    if minutes >= 15 * 60 + 15:
        return True

    return False


def _trade_opened_before_today(trade: PaperTrade) -> bool:
    """True if the trade was opened on a previous calendar day (IST)."""
    if not trade.opened_at:
        return False
    today_iso = now_ist().strftime("%Y-%m-%d")
    # opened_at is a naive ISO string like "2026-06-04T14:32:00.123456"
    return trade.opened_at[:10] < today_iso


def catch_up_squareoff(session: Session, user_id: int) -> int:
    """Close any stale open trades for `user_id`.

    A trade is considered stale if:
      - It's after 15:15 IST on a weekday (today's trades missed the cron), OR
      - It's a weekend (Friday trades left open), OR
      - The trade was opened on a previous day and is still open.

    Returns the number of trades closed.
    """
    open_trades = list(session.exec(
        select(PaperTrade)
        .where(PaperTrade.user_id == user_id)
        .where(PaperTrade.closed_at == None)
    ).all())

    if not open_trades:
        return 0

    count = 0
    past_squareoff = _should_squareoff_now()

    for trade in open_trades:
        should_close = False

        if _trade_opened_before_today(trade):
            # Previous-day trade still open — always close
            should_close = True
        elif past_squareoff:
            # Same-day trade but we're past 15:15 — close
            should_close = True

        if should_close and trade.id is not None:
            close_trade(
                session, user_id, trade.id,
                exit_price=trade.entry_price,
                exit_reason="auto_squareoff",
            )
            count += 1

    if count > 0:
        logger.info(
            "Catch-up squareoff: closed %d stale trade(s) for user %d",
            count, user_id,
        )

    return count
