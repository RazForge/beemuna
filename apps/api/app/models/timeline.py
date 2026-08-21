import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base

TIMELINE_TYPES = (
    "task",
    "subtask",
    "project",
    "goal",
    "milestone",
    "journal",
    "note",
    "calendar_event",
    "habit",
    "focus",
    "research",
    "document",
    "ai_insight",
    "reminder",
    "notification",
)


class TimelineItem(UUIDMixin, TimestampMixin, Base):
    """Unified chronological view of every entity in the application."""

    __tablename__ = "timeline_items"
    __table_args__ = (
        Index("ix_timeline_user_occurred", "user_id", "occurred_at"),
        Index("ix_timeline_user_archived", "user_id", "archived"),
        Index("ix_timeline_user_type", "user_id", "entity_type"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    group_key: Mapped[str | None] = mapped_column(String(128), index=True)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
