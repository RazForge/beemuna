import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base
from app.core.config import settings


class KnowledgeSpace(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "knowledge_spaces"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    sources: Mapped[list["Source"]] = relationship(
        back_populates="space", cascade="all, delete-orphan"
    )
    concepts: Mapped[list["Concept"]] = relationship(
        back_populates="space", cascade="all, delete-orphan"
    )


class Source(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "sources"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str | None] = mapped_column(String(255))
    storage_path: Mapped[str | None] = mapped_column(String(1000))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(120))
    checksum: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(24), default="uploading")
    error_message: Mapped[str | None] = mapped_column(Text)
    web_url: Mapped[str | None] = mapped_column(String(1000))
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)

    space: Mapped["KnowledgeSpace"] = relationship(back_populates="sources")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class DocumentChunk(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "document_chunks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int | None] = mapped_column(Integer)
    page: Mapped[int | None] = mapped_column(Integer)
    section: Mapped[str | None] = mapped_column(String(500))

    source: Mapped["Source"] = relationship(back_populates="chunks")
    embeddings: Mapped[list["Embedding"]] = relationship(
        back_populates="chunk", cascade="all, delete-orphan"
    )


class Embedding(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "embeddings"
    __table_args__ = (
        Index("ix_embeddings_chunk", "chunk_id"),
        Index(
            "ix_embeddings_user_space",
            "user_id",
            "knowledge_space_id",
            "model",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), nullable=False
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False
    )
    model: Mapped[str] = mapped_column(String(128), nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, default=settings.embedding_dimensions)
    vector: Mapped[list[float]] = mapped_column(Vector(settings.embedding_dimensions), nullable=False)

    chunk: Mapped["DocumentChunk"] = relationship(back_populates="embeddings")


class Concept(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "concepts"
    __table_args__ = (Index("ix_concepts_space_name", "knowledge_space_id", "name"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    concept_type: Mapped[str] = mapped_column(String(24), default="concept")
    description: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    aliases: Mapped[list] = mapped_column(JSONB, default=list)
    source_counts: Mapped[dict] = mapped_column(JSONB, default=dict)
    citation_ids: Mapped[list] = mapped_column(JSONB, default=list)

    space: Mapped["KnowledgeSpace"] = relationship(back_populates="concepts")
    outgoing: Mapped[list["Relationship"]] = relationship(
        back_populates="source_concept", foreign_keys="Relationship.source_concept_id",
        cascade="all, delete-orphan",
    )
    incoming: Mapped[list["Relationship"]] = relationship(
        back_populates="target_concept", foreign_keys="Relationship.target_concept_id",
        cascade="all, delete-orphan",
    )


class Relationship(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "concept_relationships"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), nullable=False
    )
    source_concept_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    target_concept_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(64), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    source_ids: Mapped[list] = mapped_column(JSONB, default=list)
    evidence: Mapped[str | None] = mapped_column(Text)

    source_concept: Mapped["Concept"] = relationship(
        back_populates="outgoing", foreign_keys=[source_concept_id]
    )
    target_concept: Mapped["Concept"] = relationship(
        back_populates="incoming", foreign_keys=[target_concept_id]
    )


class Citation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "citations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    knowledge_space_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="CASCADE"), index=True, nullable=False
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), index=True, nullable=False
    )
    chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("document_chunks.id", ondelete="CASCADE")
    )
    concept_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("concepts.id", ondelete="CASCADE")
    )
    page: Mapped[int | None] = mapped_column(Integer)
    section: Mapped[str | None] = mapped_column(String(500))
    passage: Mapped[str | None] = mapped_column(Text)
