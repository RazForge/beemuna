import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session as OrmSession

from app.models.timeline import TimelineItem


def add_timeline_item(
    db: OrmSession,
    user_id: uuid.UUID,
    entity_type: str,
    title: str,
    entity_id: uuid.UUID | None = None,
    description: str | None = None,
    occurred_at: datetime | None = None,
    group_key: str | None = None,
    meta: dict[str, Any] | None = None,
    pinned: bool = False,
    archived: bool = False,
) -> TimelineItem:
    item = TimelineItem(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        title=title,
        description=description,
        occurred_at=occurred_at or datetime.now(UTC),
        group_key=group_key,
        meta=meta or {},
        pinned=pinned,
        archived=archived,
    )
    db.add(item)
    db.flush()
    return item