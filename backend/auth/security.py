"""
Tradeflow Auth — bcrypt password hashing + JWT issuance.

Token shape (HS256):
    {
      "sub": "<user_id>",
      "email": "<email>",
      "iat": <unix>,
      "exp": <unix>
    }

Secret comes from `JWT_SECRET` env. We log loudly if it isn't set — fine for
dev, but never deploy without a real secret.

Why not passlib?
----------------
passlib 1.7.4 (last release: 2020) is incompatible with bcrypt >= 4.1: it
looks up `bcrypt.__about__.__version__` which no longer exists, then falls
into a buggy probe that pushes a 73-byte string into bcrypt and crashes.
The bcrypt project's own docs now recommend using the library directly, so
that's what we do.

bcrypt's 72-byte input limit
----------------------------
bcrypt only hashes the first 72 bytes of the password. Passing anything
longer either truncates silently (older bcrypt) or raises (>=4.1). We
explicitly enforce the limit before hashing AND before verifying so the
behaviour is deterministic regardless of which bcrypt version is installed.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

log = logging.getLogger(__name__)

JWT_ALG = "HS256"
JWT_TTL_DAYS = 30

# bcrypt's underlying algorithm only considers the first 72 bytes of input.
_BCRYPT_MAX_BYTES = 72


# Resolve the JWT secret exactly once at module load. The previous version
# called os.environ.get on every encode/decode AND log.warning'd on every miss
# — with a 15s frontend poll that flooded the uvicorn terminal with the same
# warning ~4x/min, drowning the actual access logs. One warning at startup
# (or on uvicorn --reload) is the right cadence; the message is still loud
# enough that no-one ships to prod without noticing.
_JWT_SECRET = os.environ.get("JWT_SECRET")
if not _JWT_SECRET:
    log.warning(
        "JWT_SECRET is not set — using an insecure default. "
        "Set JWT_SECRET in backend/.env before deploying anywhere."
    )
    _JWT_SECRET = "tradeflow-dev-insecure-change-me"


def _jwt_secret() -> str:
    assert _JWT_SECRET is not None
    return _JWT_SECRET


def _to_bcrypt_input(plain: str) -> bytes:
    """Encode and clamp to 72 bytes. Always done on both hash and verify."""
    encoded = plain.encode("utf-8")
    return encoded[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    """Return a bcrypt hash as a str (`$2b$12$...`)."""
    hashed = bcrypt.hashpw(_to_bcrypt_input(plain), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(_to_bcrypt_input(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed stored hash → treat as a failed login, not a crash.
        return False


def create_access_token(user_id: int, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub":   str(user_id),
        "email": email,
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(days=JWT_TTL_DAYS)).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALG)


def decode_access_token(token: str) -> dict:
    """Returns the payload dict. Raises `jwt.PyJWTError` subclasses on failure."""
    return jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALG])
