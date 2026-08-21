import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base


class AIConversation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_conversations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), index=True
    )
    mode: Mapped[str] = mapped_column(String(24), default="assistant")
    title: Mapped[str | None] = mapped_column(String(300))

    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AIMessage(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "ai_messages"
    __table_args__ = (Index("ix_ai_messages_conversation", "conversation_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="completed")
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")
