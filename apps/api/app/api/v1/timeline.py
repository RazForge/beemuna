import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.timeline import TIMELINE_TYPES, TimelineItem
from app.models.user import User
from app.schemas.timeline import TimelineItemIn, TimelineItemOut, TimelineItemUpdate, TimelinePage
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/timeline", tags=["timeline"])


def _get_item(db: OrmSession, item_id: uuid.UUID, user: User) -> TimelineItem:
    item = db.query(TimelineItem).filter(
        TimelineItem.id == item_id, TimelineItem.user_id == user.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Timeline item not found")
    return item


@router.get("", response_model=TimelinePage)
def list_timeline(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    pinned: bool | None = Query(default=None),
    archived: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TimelinePage:
    q = db.query(TimelineItem).filter(
        TimelineItem.user_id == user.id,
        TimelineItem.archived == archived,
    )
    if start:
        q = q.filter(TimelineItem.occurred_at >= start)
    if end:
        q = q.filter(TimelineItem.occurred_at <= end)
    if entity_type:
        q = q.filter(TimelineItem.entity_type == entity_type)
    if pinned is not None:
        q = q.filter(TimelineItem.pinned == pinned)

    total = q.count()
    items = (
        q.order_by(
            TimelineItem.pinned.desc(),
            TimelineItem.occurred_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return TimelinePage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=page * page_size < total,
    )


@router.post("", response_model=TimelineItemOut, status_code=201)
def create_timeline_item(
    payload: TimelineItemIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TimelineItem:
    if payload.entity_type not in TIMELINE_TYPES:
        raise HTTPException(status_code=422, detail="Unknown entity type")
    item = add_timeline_item(
        db,
        user.id,
        payload.entity_type,
        payload.title,
        entity_id=payload.entity_id,
        description=payload.description,
        occurred_at=payload.occurred_at,
        group_key=payload.group_key,
        meta=payload.meta,
    )
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=TimelineItemOut)
def update_item(
    item_id: uuid.UUID,
    payload: TimelineItemUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TimelineItem:
    item = _get_item(db, item_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(
    item_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    item = _get_item(db, item_id, user)
    db.delete(item)
    db.commit()