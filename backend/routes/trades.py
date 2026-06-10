from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, cast
from sqlmodel import Session, select, col

from database import get_db
from models import User, PaperTrade, PremarketLog, UserStat
from data.nse import get_option_chain
from trades.paper import (
    open_trade, close_trade, get_open_trades,
    get_trade_history, bump_activity_streak, XP_RULES, _ensure_user_stats
)
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/trades", tags=["Trades"])

class TradeInput(BaseModel):
    instrument:  str
    direction:   str       # BUY or SELL
    quantity:    int
    entry_price: float
    stop_loss:   float
    target:      float
    thesis:      Optional[str] = None

class CloseInput(BaseModel):
    exit_price:  float
    exit_reason: str       # target_hit / stop_hit / manual / auto_squareoff

class ThesisInput(BaseModel):
    thesis: str = ""


@router.post("")
def create_trade(
    body: TradeInput,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Open a new paper trade."""
    if body.direction not in ("BUY", "SELL"):
        raise HTTPException(400, "direction must be BUY or SELL")

    pm = session.exec(
        select(PremarketLog).order_by(col(PremarketLog.run_at).desc())
    ).first()

    assert current_user.id is not None
    trade_id = open_trade(
        session=session,
        user_id=current_user.id,
        instrument=body.instrument,
        direction=body.direction,
        quantity=body.quantity,
        entry_price=body.entry_price,
        stop_loss=body.stop_loss,
        target=body.target,
        thesis=body.thesis,
        premarket_id=pm.id if pm else None,
    )

    return {"trade_id": trade_id, "status": "open"}


@router.post("/{trade_id}/close")
def close_trade_endpoint(
    trade_id: int,
    body: CloseInput,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Close a paper trade with exit price and reason."""
    assert current_user.id is not None
    pnl = close_trade(session, current_user.id, trade_id, body.exit_price, body.exit_reason)
    if pnl is None:
        raise HTTPException(404, "Trade not found or already closed")
    return {"trade_id": trade_id, "pnl": pnl, "status": "closed"}


# ── Internal helpers (called by the scheduler, NOT exposed as HTTP) ──────

async def auto_squareoff_endpoint(session: Session):
    """Square off all open paper trades across all users at 3:15 PM IST."""
    open_trades = session.exec(select(PaperTrade).where(PaperTrade.closed_at == None)).all()
    if not open_trades:
        return {"status": "success", "message": "No open trades"}

    count = 0
    chains: dict[str, dict] = {}
    for t in open_trades:
        exit_price = t.entry_price
        parts = t.instrument.split()
        if len(parts) >= 3 and parts[0] in ("NIFTY", "BANKNIFTY", "FINNIFTY"):
            try:
                symbol = parts[0]
                strike = float(parts[1])
                opt_type = parts[2].upper()
                if symbol not in chains:
                    chains[symbol] = cast(dict, await get_option_chain(symbol))
                chain = chains[symbol]
                for strike_data in chain.get("strikes", []):
                    if float(strike_data["strike"]) == strike:
                        if opt_type == "CE" and strike_data["ce_ltp"] > 0:
                            exit_price = strike_data["ce_ltp"]
                        elif opt_type == "PE" and strike_data["pe_ltp"] > 0:
                            exit_price = strike_data["pe_ltp"]
                        break
            except Exception:
                pass

        if t.user_id is None or t.id is None:
            continue
            
        close_trade(session, t.user_id, t.id, exit_price, "auto_squareoff")
        count += 1

    return {"status": "success", "closed_count": count}


async def monitor_sl_target_endpoint(session: Session):
    """Check all open paper trades against current LTP and auto-close if SL or target hit."""
    open_trades = session.exec(select(PaperTrade).where(PaperTrade.closed_at == None)).all()
    if not open_trades:
        return {"status": "success", "message": "No open trades to monitor"}

    chains: dict[str, dict] = {}
    closed: list[dict] = []

    for t in open_trades:
        if t.user_id is None or t.id is None:
            continue

        parts = t.instrument.split()
        if len(parts) < 3 or parts[0] not in ("NIFTY", "BANKNIFTY", "FINNIFTY"):
            continue

        symbol = parts[0]
        strike = float(parts[1])
        opt_type = parts[2].upper()

        if symbol not in chains:
            try:
                chains[symbol] = cast(dict, await get_option_chain(symbol))
            except Exception:
                continue

        chain = chains[symbol]
        ltp = None
        for sd in chain.get("strikes", []):
            if float(sd["strike"]) == strike:
                ltp = sd.get("ce_ltp") if opt_type == "CE" else sd.get("pe_ltp")
                break

        if not ltp or ltp <= 0:
            continue

        sl = t.stop_loss
        target = t.target
        direction = t.direction

        exit_reason = None
        if direction == "BUY":
            if sl and ltp <= sl:
                exit_reason = "stop_hit"
            elif target and ltp >= target:
                exit_reason = "target_hit"
        else:  # SELL
            if sl and ltp >= sl:
                exit_reason = "stop_hit"
            elif target and ltp <= target:
                exit_reason = "target_hit"

        if exit_reason:
            try:
                close_trade(session, t.user_id, t.id, ltp, exit_reason)
                closed.append({
                    "trade_id": t.id,
                    "instrument": t.instrument,
                    "reason": exit_reason,
                    "ltp": ltp,
                })
            except Exception:
                pass

    return {"status": "success", "triggered": len(closed), "details": closed}


@router.get("/open", response_model=list[PaperTrade])
def list_open_trades(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get all currently open paper trades."""
    assert current_user.id is not None
    return get_open_trades(session, current_user.id)


@router.get("/history", response_model=list[PaperTrade])
def list_trade_history(
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Get closed trades, most recent first."""
    assert current_user.id is not None
    return get_trade_history(session, current_user.id, limit, offset)


@router.patch("/{trade_id}/thesis")
def update_trade_thesis(
    trade_id: int,
    body: ThesisInput,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db)
):
    """Add or update the thesis on any trade (open or closed)."""
    assert current_user.id is not None
    thesis = body.thesis.strip()
    
    trade = session.exec(
        select(PaperTrade)
        .where(PaperTrade.id == trade_id)
        .where(PaperTrade.user_id == current_user.id)
    ).first()
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    first_thesis = not trade.thesis and thesis
    trade.thesis = thesis or None

    if first_thesis:
        _ensure_user_stats(session, current_user.id)
        xp = XP_RULES["wrote_thesis"]
        
        stats = session.exec(select(UserStat).where(UserStat.user_id == current_user.id)).first()
        if stats:
            stats.total_xp += xp
            session.add(stats)
            
        trade.xp_earned += xp
        bump_activity_streak(session, current_user.id)

    session.add(trade)
    session.commit()
    
    return {"ok": True, "xp_awarded": 15 if first_thesis else 0}
