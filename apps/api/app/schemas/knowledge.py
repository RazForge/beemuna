import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Knowledge Spaces ─────────────────────────────────────────────────────────

class KnowledgeSpaceIn(BaseModel):
    name: str = Field(max_length=300)
    description: str | None = None

class KnowledgeSpaceUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    description: str | None = None
    archived: bool | None = None

class KnowledgeSpaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    archived: bool
    created_at: datetime
    updated_at: datetime


# ── Sources ───────────────────────────────────────────────────────────────────

class SourceUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, max_length=24)
    error_message: str | None = None
    meta: dict[str, Any] | None = None

class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    knowledge_space_id: uuid.UUID
    type: str
    title: str
    filename: str | None
    storage_path: str | None
    size_bytes: int | None
    mime_type: str | None
    checksum: str | None
    status: str
    error_message: str | None
    web_url: str | None
    meta: dict[str, Any]
    created_at: datetime
    updated_at: datetime


# ── Document Chunks ──────────────────────────────────────────────────────────

class DocumentChunkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: uuid.UUID
    chunk_index: int
    content: str
    token_count: int | None
    page: int | None
    section: str | None
    created_at: datetime


# ── Concepts ──────────────────────────────────────────────────────────────────

class ConceptIn(BaseModel):
    name: str = Field(max_length=300)
    concept_type: str = Field(default="concept", max_length=24)
    description: str | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    aliases: list[str] = []

class ConceptUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    concept_type: str | None = Field(default=None, max_length=24)
    description: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    aliases: list[str] | None = None

class ConceptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    knowledge_space_id: uuid.UUID
    name: str
    concept_type: str
    description: str | None
    confidence: float
    aliases: list[Any]
    source_counts: dict[str, Any]
    citation_ids: list[Any]
    created_at: datetime
    updated_at: datetime


# ── Relationships ─────────────────────────────────────────────────────────────

class RelationshipIn(BaseModel):
    source_concept_id: uuid.UUID
    target_concept_id: uuid.UUID
    relationship_type: str = Field(max_length=64)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: str | None = None

class RelationshipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_concept_id: uuid.UUID
    target_concept_id: uuid.UUID
    relationship_type: str
    confidence: float
    evidence: str | None
    created_at: datetime


# ── Citations ─────────────────────────────────────────────────────────────────

class CitationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_id: uuid.UUID
    chunk_id: uuid.UUID | None
    concept_id: uuid.UUID | None
    page: int | None
    section: str | None
    passage: str | None
    created_at: datetime


# ── Search ────────────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    chunk: DocumentChunkOut
    source: SourceOut
    score: float