import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base

AI_ACCESS_DEFAULTS = {
    "tasks": True,
    "goals": True,
    "projects": True,
    "calendar": True,
    "habits": True,
    "journal": False,
    "notes": True,
    "knowledge": True,
}


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    auth_provider: Mapped[str] = mapped_column(String(16), default="password")
    name: Mapped[str | None] = mapped_column(String(120))
    religion: Mapped[str] = mapped_column(String(16), default="unspecified")
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", index=True)
    language: Mapped[str] = mapped_column(String(8), default="en")
    theme: Mapped[str] = mapped_column(String(16), default="system")
    calendar_mode: Mapped[str] = mapped_column(String(16), default="gregorian")
    numeral_mode: Mapped[str] = mapped_column(String(16), default="western")
    quiet_hours_start: Mapped[str] = mapped_column(String(5), default="22:00")
    quiet_hours_end: Mapped[str] = mapped_column(String(5), default="07:00")
    ai_access: Mapped[dict] = mapped_column(JSONB, default=AI_ACCESS_DEFAULTS)
    ai_perspective: Mapped[str] = mapped_column(String(24), default="neutral")
    ai_local_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_local_model: Mapped[str | None] = mapped_column(String(64))
    ai_cloud_model: Mapped[str | None] = mapped_column(String(64))
    ai_memory_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    ai_journal_context: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_save_new_memories: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_channels: Mapped[dict] = mapped_column(
        JSONB, default=lambda: {"in_app": True, "browser": True}
    )
    city: Mapped[str | None] = mapped_column(String(120))
    profile_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    subscription: Mapped["Subscription | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Session(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(512))

    user: Mapped["User"] = relationship(back_populates="sessions")


class Subscription(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active")
    stripe_customer_id: Mapped[str | None] = mapped_column(String(128), index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(128), index=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="subscription")
