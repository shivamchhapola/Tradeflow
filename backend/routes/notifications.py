from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, col, func, delete

from database import get_db, create_notification
from models import Notification
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class CreateNotificationReq(BaseModel):
    type: str  # trade_executed, stop_hit, target_hit, manual_close, auto_squareoff, system_error, info, warning
    title: str
    message: str
    details: Optional[str] = None

class MarkReadReq(BaseModel):
    ids: Optional[list[int]] = None
    mark_all: bool = False

@router.get("")
def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    unread_only: bool = Query(False),
    type_category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    user_id = current_user["id"]
    
    # Query items
    stmt = select(Notification).where(Notification.user_id == user_id)
    if before_id:
        stmt = stmt.where(Notification.id < before_id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)
        
    if type_category == "trades":
        stmt = stmt.where(col(Notification.type).in_(["trade_executed", "stop_hit", "target_hit", "manual_close", "auto_squareoff"]))
    elif type_category == "errors":
        stmt = stmt.where(col(Notification.type).in_(["system_error", "error"]))

    stmt = stmt.order_by(col(Notification.id).desc()).limit(limit + 1)
    results = list(session.exec(stmt).all())
    
    has_more = len(results) > limit
    items = results[:limit]
    next_cursor = items[-1].id if (has_more and items) else None
    
    # Compute total unread count
    unread_stmt = select(func.count(col(Notification.id))).where(
        Notification.user_id == user_id,
        Notification.is_read == False,
    )
    unread_count = session.exec(unread_stmt).one() or 0
    
    return {
        "items": items,
        "unread_count": unread_count,
        "has_more": has_more,
        "next_cursor": next_cursor,
    }

@router.get("/{notification_id}")
def get_notification(
    notification_id: int,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    user_id = current_user["id"]
    item = session.exec(
        select(Notification)
        .where(Notification.id == notification_id)
        .where(Notification.user_id == user_id)
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    return item

@router.post("")
def post_notification(
    body: CreateNotificationReq,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    user_id = current_user["id"]
    item = create_notification(
        session=session,
        user_id=user_id,
        type=body.type,
        title=body.title,
        message=body.message,
        details=body.details,
    )
    return item

@router.post("/mark-read")
def mark_read(
    body: MarkReadReq,
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    user_id = current_user["id"]
    stmt = select(Notification).where(Notification.user_id == user_id)
    
    if not body.mark_all and body.ids:
        stmt = stmt.where(col(Notification.id).in_(body.ids))
    elif not body.mark_all and not body.ids:
        return {"success": True, "updated_count": 0}
        
    items = session.exec(stmt).all()
    count = 0
    for item in items:
        if not item.is_read:
            item.is_read = True
            session.add(item)
            count += 1
            
    session.commit()
    return {"success": True, "updated_count": count}

@router.delete("/clear")
def clear_read_notifications(
    current_user: dict = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    user_id = current_user["id"]
    stmt = delete(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read == True,
    )
    res = session.exec(stmt)
    session.commit()
    return {"success": True}
