import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session as OrmSession

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import Session as SessionModel
from app.models.user import User

ACCESS_TOKEN_COOKIE = "beemuna_token"


class CredentialsError(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _extract_token(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.cookies.get(ACCESS_TOKEN_COOKIE)


def get_current_user(
    request: Request,
    db: OrmSession = Depends(get_db),
) -> User:
    token = _extract_token(request)
    if not token:
        raise CredentialsError()
    payload = decode_access_token(token)
    if not payload or "sub" not in payload or "sid" not in payload:
        raise CredentialsError()
    try:
        user_id = uuid.UUID(payload["sub"])
        session_id = uuid.UUID(payload["sid"])
    except ValueError:
        raise CredentialsError()

    session = (
        db.query(SessionModel)
        .filter(SessionModel.id == session_id, SessionModel.user_id == user_id)
        .first()
    )
    if (
        not session
        or session.revoked_at is not None
        or session.expires_at < datetime.now(UTC)
    ):
        raise CredentialsError()

    user = db.get(User, user_id)
    if not user or user.deleted_at is not None:
        raise CredentialsError()
    return user


def create_session(db: OrmSession, user_id: uuid.UUID, ip: str | None, user_agent: str | None) -> SessionModel:
    session = SessionModel(
        user_id=user_id,
        token_hash=uuid.uuid4().hex,
        expires_at=datetime.now(UTC) + timedelta(days=30),
        ip=ip,
        user_agent=(user_agent or "")[:512] or None,
    )
    db.add(session)
    db.flush()
    return session


def revoke_session(db: OrmSession, session_id: uuid.UUID) -> None:
    session = db.get(SessionModel, session_id)
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(UTC)
