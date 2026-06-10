"""
Tradeflow Auth — FastAPI dependencies.

`get_current_user` reads `Authorization: Bearer <jwt>`, decodes the token,
loads the user row, and returns it. Any failure → 401.

`get_current_user_optional` returns `None` when no/invalid token is present.
"""

from __future__ import annotations

import logging
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlmodel import Session

from database import get_db
from models import User
from .security import decode_access_token

log = logging.getLogger(__name__)


def _extract_bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def get_current_user(
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_db)
) -> User:
    """Required-auth dependency. 401 on any failure."""
    token = _extract_bearer(authorization)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired — please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Malformed token subject.")

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(401, "User no longer exists.")
    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    session: Session = Depends(get_db)
) -> Optional[User]:
    """Optional-auth dependency. Returns None when token is absent/invalid."""
    token = _extract_bearer(authorization)
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        return None
    return session.get(User, user_id)
