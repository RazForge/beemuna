import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base


class Reminder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "reminders"
    __table_args__ = (
        Index("ix_reminders_scheduled", "scheduled_at", "status"),
        Index("ix_reminders_user", "user_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    related_entity_type: Mapped[str | None] = mapped_column(String(32))
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column()
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    recurrence_rule: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(16), default="scheduled")
    priority: Mapped[str] = mapped_column(String(12), default="normal")
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    quiet_hours_ok: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)


class Notification(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_read", "user_id", "read_at"),
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reminder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reminders.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    related_entity_type: Mapped[str | None] = mapped_column(String(32))
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column()
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    channel: Mapped[str] = mapped_column(String(16), default="in_app")
    snoozed_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
