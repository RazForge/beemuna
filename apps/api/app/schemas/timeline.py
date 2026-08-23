import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TimelineItemIn(BaseModel):
    entity_type: str = Field(max_length=32)
    entity_id: uuid.UUID | None = None
    title: str = Field(max_length=500)
    description: str | None = None
    occurred_at: datetime | None = None
    group_key: str | None = Field(default=None, max_length=128)
    meta: dict[str, Any] = {}

class TimelineItemUpdate(BaseModel):
    pinned: bool | None = None
    archived: bool | None = None
    description: str | None = None

class TimelineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID | None
    title: str
    description: str | None
    occurred_at: datetime
    pinned: bool
    archived: bool
    group_key: str | None
    meta: dict[str, Any]
    created_at: datetime

class TimelinePage(BaseModel):
    items: list[TimelineItemOut]
    total: int
    page: int
    page_size: int
    has_more: bool