import uuid
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, TimestampSigner
from sqlalchemy import or_
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import create_session, get_current_user, revoke_session
from app.core.audit import audit
from app.core.config import settings
from app.core.database import get_db
from app.core.mailer import send_email
from app.core.security import create_access_token, hash_password, needs_rehash, new_token, verify_password
from app.models.user import Session as SessionModel
from app.models.user import User
from app.schemas.auth import (
    AuthOut,
    GoogleLoginIn,
    LoginIn,
    MessageOut,
    PasswordChangeIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    ProfileUpdateIn,
    RegisterIn,
    ResendVerificationIn,
    SessionOut,
    UserOut,
    VerifyEmailIn,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_signer = TimestampSigner(settings.secret_key)

TOKEN_MAX_AGE = 60 * 60 * 24  # 24h


def _client_info(request: Request) -> tuple[str | None, str | None]:
    ip = request.client.host if request.client else None
    if ip and request.headers.get("X-Forwarded-For"):
        ip = request.headers["X-Forwarded-For"].split(",")[0].strip()
    return ip, request.headers.get("User-Agent")


def _issue_auth(db: OrmSession, user: User, request: Request, response: Response) -> AuthOut:
    ip, ua = _client_info(request)
    session = create_session(db, user.id, ip, ua)
    token = create_access_token(user.id, session.id)
    audit(db, "auth.login", user_id=user.id, ip=ip, user_agent=ua)
    db.commit()
    response.set_cookie(
        key="beemuna_token",
        value=token,
        httponly=True,
        secure=settings.environment != "development",
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return AuthOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, request: Request, response: Response, db: OrmSession = Depends(get_db)) -> AuthOut:
    if not settings.register_enabled:
        raise HTTPException(status_code=403, detail="Registration is disabled")

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        name=payload.name,
        religion=payload.religion,
        timezone=settings.default_timezone,
        profile_completed_at=datetime.now(UTC),
    )
    db.add(user)
    db.flush()

    token = _signer.sign(payload.email.lower()).decode()
    ip, ua = _client_info(request)
    audit(db, "auth.register", user_id=user.id, ip=ip, user_agent=ua)
    db.commit()
    if settings.smtp_host:
        send_email(
            user.email,
            "Verify your BE'EMUNA account",
            f"<p>Click the link below to verify your email:</p><p><a href='http://localhost:8000/api/v1/auth/verify/email?token={token}'>Verify Email</a></p>",
        )
    return _issue_auth(db, user, request, response)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, request: Request, response: Response, db: OrmSession = Depends(get_db)) -> AuthOut:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
        db.commit()
    return _issue_auth(db, user, request, response)


@router.post("/logout", response_model=MessageOut)
def logout(request: Request, response: Response, db: OrmSession = Depends(get_db), user: User = Depends(get_current_user)) -> MessageOut:
    token = (request.headers.get("Authorization") or request.cookies.get("beemuna_token") or "")
    payload = None
    from app.core.security import decode_access_token

    payload = decode_access_token(token.removeprefix("Bearer ").strip())
    if payload and "sid" in payload:
        try:
            revoke_session(db, uuid.UUID(payload["sid"]))
        except ValueError:
            pass
    db.commit()
    response.delete_cookie("beemuna_token", path="/")
    return MessageOut(message="Logged out")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/sessions", response_model=list[SessionOut])
def list_sessions(db: OrmSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[SessionModel]:
    return (
        db.query(SessionModel)
        .filter(SessionModel.user_id == user.id)
        .order_by(SessionModel.created_at.desc())
        .limit(50)
        .all()
    )


@router.delete("/sessions/{session_id}", response_model=MessageOut)
def revoke_other_session(
    session_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    session = db.get(SessionModel, session_id)
    if not session or session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    revoke_session(db, session.id)
    db.commit()
    return MessageOut(message="Session revoked")


@router.post("/verify/email", response_model=MessageOut)
def verify_email(payload: VerifyEmailIn, db: OrmSession = Depends(get_db)) -> MessageOut:
    try:
        email = _signer.unsign(payload.token, max_age=TOKEN_MAX_AGE).decode()
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.email_verified:
        return MessageOut(message="Email already verified")
    user.email_verified = True
    db.commit()
    return MessageOut(message="Email verified")


@router.post("/verify/resend", response_model=MessageOut)
def resend_verification(payload: ResendVerificationIn, db: OrmSession = Depends(get_db)) -> MessageOut:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or user.email_verified:
        return MessageOut(message="If the account exists, a verification email was sent")
    token = _signer.sign(payload.email.lower()).decode()
    if settings.smtp_host:
        send_email(
            user.email,
            "Verify your BE'EMUNA account",
            f"<p>Click the link below to verify your email:</p><p><a href='http://localhost:8000/api/v1/auth/verify/email?token={token}'>Verify Email</a></p>",
        )
    return MessageOut(message="If the account exists, a verification email was sent")


@router.post("/password/change", response_model=MessageOut)
def change_password(
    payload: PasswordChangeIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    now = datetime.now(UTC)
    for session in db.query(SessionModel).filter(SessionModel.user_id == user.id):
        if session.revoked_at is None:
            session.revoked_at = now
    db.commit()
    return MessageOut(message="Password changed. All sessions were signed out.")


@router.post("/password/reset", response_model=MessageOut)
def request_password_reset(payload: PasswordResetRequestIn, db: OrmSession = Depends(get_db)) -> MessageOut:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user:
        token = _signer.sign(payload.email.lower()).decode()
        if settings.smtp_host:
            send_email(
                user.email,
                "Reset your BE'EMUNA password",
                f"<p>Click the link below to reset your password:</p><p><a href='http://localhost:8000/api/v1/auth/password/reset/confirm?token={token}'>Reset Password</a></p>",
            )
    return MessageOut(message="If the account exists, a reset link was sent")


@router.post("/password/reset/confirm", response_model=MessageOut)
def confirm_password_reset(payload: PasswordResetConfirmIn, db: OrmSession = Depends(get_db)) -> MessageOut:
    try:
        email = _signer.unsign(payload.token, max_age=TOKEN_MAX_AGE).decode()
    except (BadSignature, SignatureExpired):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found")
    user.password_hash = hash_password(payload.new_password)
    now = datetime.now(UTC)
    for session in db.query(SessionModel).filter(SessionModel.user_id == user.id):
        if session.revoked_at is None:
            session.revoked_at = now
    db.commit()
    return MessageOut(message="Password reset. All sessions were signed out.")


def _verify_google_id_token(token: str) -> dict | None:
    """Verify a Google ID token against Google's tokeninfo endpoint."""
    try:
        resp = httpx.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": token},
            timeout=10,
        )
    except httpx.HTTPError:
        return None
    if resp.status_code != 200:
        return None
    try:
        return resp.json()
    except ValueError:
        return None


@router.post("/google", response_model=AuthOut)
def google_login(
    payload: GoogleLoginIn,
    request: Request,
    response: Response,
    db: OrmSession = Depends(get_db),
) -> AuthOut:
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")

    info = _verify_google_id_token(payload.id_token)
    if not info:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    if info.get("aud") != settings.google_client_id:
        raise HTTPException(status_code=401, detail="Token audience mismatch")
    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    if float(info.get("exp", 0)) < datetime.now(UTC).timestamp():
        raise HTTPException(status_code=401, detail="Expired Google token")

    sub = info.get("sub")
    email = (info.get("email") or "").lower()
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Token missing sub/email")

    user = db.query(User).filter(User.google_sub == sub).first()
    if not user:
        # Link to an existing email/password account if one matches, else create new.
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.google_sub = sub
            user.auth_provider = "google"
        else:
            user = User(
                email=email,
                google_sub=sub,
                auth_provider="google",
                password_hash=None,
                name=info.get("name"),
                avatar_url=info.get("picture"),
                email_verified=True,
                timezone=settings.default_timezone,
            )
            db.add(user)
            db.flush()

    user.email_verified = True
    if info.get("picture") and info["picture"] != user.avatar_url:
        user.avatar_url = info["picture"]
    if info.get("name") and not user.name:
        user.name = info["name"]

    return _issue_auth(db, user, request, response)


@router.post("/profile/complete", response_model=UserOut)
def complete_profile(
    payload: ProfileUpdateIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    """Finish setup after a Google sign-up: choose name, city, timezone, religion."""
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    user.profile_completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/account", response_model=MessageOut)
def delete_account(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MessageOut:
    """Permanently delete the current user's account and all associated data."""
    user.deleted_at = datetime.now(UTC)
    user.email = f"deleted_{user.id}@{user.email.split('@')[-1]}"
    user.google_sub = None
    user.password_hash = None
    user.name = None
    user.avatar_url = None
    # Revoke all sessions
    for session in db.query(SessionModel).filter(SessionModel.user_id == user.id):
        if session.revoked_at is None:
            session.revoked_at = datetime.now(UTC)
    db.commit()
    return MessageOut(message="Account deleted. We're sorry to see you go.")
