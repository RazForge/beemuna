import uuid
import sqlalchemy as sa
from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base


class AIMemory(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_memories"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(32), default="fact", nullable=False)
    source: Mapped[str] = mapped_column(String(32), default="user", nullable=False)
    importance: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    tags: Mapped[dict] = mapped_column(sa.dialects.postgresql.JSONB, default=list)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]
