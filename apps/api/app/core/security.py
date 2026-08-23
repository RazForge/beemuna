import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

_ph = PasswordHasher(time_cost=4, memory_cost=131072, parallelism=4)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def needs_rehash(hash: str) -> bool:
    try:
        info = _ph.check_hashes([hash])
        return not all(
            p.time_cost == _ph.time_cost
            and p.memory_cost == _ph.memory_cost
            and p.parallelism == _ph.parallelism
            for p in info
        )
    except Exception:
        return True


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: uuid.UUID, session_id: uuid.UUID) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None


def new_token() -> str:
    return uuid.uuid4().hex
