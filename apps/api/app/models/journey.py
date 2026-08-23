"""Journey system models — achievements, progress paths, life scores."""

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base


class Achievement(UUIDMixin, TimestampMixin, Base):
    """An unlocked achievement/badge."""
    __tablename__ = "achievements"
    __table_args__ = (
        Index("ix_achievements_user_unlocked", "user_id", "unlocked_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(10))
    badge_color: Mapped[str | None] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(32), default="general")
    tier: Mapped[str] = mapped_column(String(16), default="bronze")
    points: Mapped[int] = mapped_column(Integer, default=10)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source_type: Mapped[str | None] = mapped_column(String(32))
    source_id: Mapped[str | None] = mapped_column(String(64))
    seen: Mapped[bool] = mapped_column(Boolean, default=False)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)


class ProgressPath(UUIDMixin, TimestampMixin, Base):
    """A learning/growth path with stages."""
    __tablename__ = "progress_paths"
    __table_args__ = (
        UniqueConstraint("user_id", "slug"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(32), default="general")
    stages: Mapped[list] = mapped_column(JSONB, default=list)
    current_stage_index: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)


class LifeScore(UUIDMixin, TimestampMixin, Base):
    """Point-in-time life score snapshot."""
    __tablename__ = "life_scores"
    __table_args__ = (
        Index("ix_life_scores_user_date", "user_id", "scored_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    productivity: Mapped[float] = mapped_column(Float, default=0)
    knowledge: Mapped[float] = mapped_column(Float, default=0)
    health: Mapped[float] = mapped_column(Float, default=0)
    faith: Mapped[float] = mapped_column(Float, default=0)
    learning: Mapped[float] = mapped_column(Float, default=0)
    overall: Mapped[float] = mapped_column(Float, default=0)
    breakdown: Mapped[dict] = mapped_column(JSONB, default=dict)
    scored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
