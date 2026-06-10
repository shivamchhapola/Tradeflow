"""
Tradeflow Auth — FastAPI routes.

Endpoints (all under /api/auth):
    POST   /signup            { email, password, display_name? } → { token, user }
    POST   /login             { email, password }                → { token, user }
    GET    /me                                                   → { user, stats }
    POST   /change-password   { old, new }                       → { ok: true }
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from database import get_db
from models import User, UserStat, UserAchievement
from .dependencies import get_current_user
from .security import create_access_token, hash_password, verify_password
from trades.squareoff import catch_up_squareoff

router = APIRouter(prefix="/api/auth", tags=["auth"])

# ── Models ───────────────────────────────────────────────────────────────────

class SignupBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)

class LoginBody(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)

class UserPublic(BaseModel):
    id: int
    email: str
    display_name: str | None
    created_at: str
    kite_user_id: str | None

class AuthResponse(BaseModel):
    token: str
    user: UserPublic

class UserStatsResponse(BaseModel):
    total_xp: int
    streak_days: int
    last_active: str | None
    virtual_balance: float

class MeResponse(BaseModel):
    user: UserPublic
    stats: UserStatsResponse
    achievements: list[str]

class SuccessResponse(BaseModel):
    ok: bool

# ── Helpers ──────────────────────────────────────────────────────────────────

def _user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        created_at=user.created_at,
        kite_user_id=user.kite_user_id,
    )

# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=AuthResponse)
def signup(body: SignupBody, session: Session = Depends(get_db)):
    email_lower = body.email.lower()
    existing = session.exec(select(User).where(User.email == email_lower)).first()
    if existing:
        raise HTTPException(409, "An account with that email already exists.")

    now_iso = datetime.now(timezone.utc).isoformat()
    new_user = User(
        email=email_lower,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
        created_at=now_iso,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    if new_user.id is None:
        raise HTTPException(500, "Database failed to generate user ID.")

    session.add(UserStat(user_id=new_user.id))
    session.commit()

    token = create_access_token(new_user.id, new_user.email)
    return AuthResponse(token=token, user=_user_public(new_user))

@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody, session: Session = Depends(get_db)):
    email_lower = body.email.lower()
    user = session.exec(select(User).where(User.email == email_lower)).first()

    if not user or not user.id or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    # Catch up any stale open trades missed by the 3:15 PM cron
    catch_up_squareoff(session, user.id)

    token = create_access_token(user.id, user.email)
    return AuthResponse(token=token, user=_user_public(user))

@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), session: Session = Depends(get_db)):
    """Return the auth'd user + their stats — used by AuthContext on boot."""
    assert current_user.id is not None

    # Catch up any stale open trades missed by the 3:15 PM cron
    catch_up_squareoff(session, current_user.id)

    stats_row = session.exec(select(UserStat).where(UserStat.user_id == current_user.id)).first()

    stats = UserStatsResponse(
        total_xp=stats_row.total_xp if stats_row else 0,
        streak_days=stats_row.streak_days if stats_row else 0,
        last_active=stats_row.last_active if stats_row else None,
        virtual_balance=stats_row.virtual_balance if stats_row else 500000.0,
    )
    
    achievements_rows = session.exec(select(UserAchievement).where(UserAchievement.user_id == current_user.id)).all()
    achievements = [row.achievement_id for row in achievements_rows]
    
    return MeResponse(user=_user_public(current_user), stats=stats, achievements=achievements)

@router.post("/change-password", response_model=SuccessResponse)
def change_password(
    body: ChangePasswordBody,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
):
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(401, "Current password is incorrect.")

    current_user.password_hash = hash_password(body.new_password)
    session.add(current_user)
    session.commit()
    return SuccessResponse(ok=True)
