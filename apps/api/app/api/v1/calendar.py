import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import CalendarEvent
from app.models.user import User
from app.schemas.productivity import CalendarEventIn, CalendarEventOut, CalendarEventUpdate
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _get_event(db: OrmSession, event_id: uuid.UUID, user: User) -> CalendarEvent:
    event = db.query(CalendarEvent).filter(
        CalendarEvent.id == event_id, CalendarEvent.user_id == user.id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("", response_model=list[CalendarEventOut])
def list_events(
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[CalendarEvent]:
    q = db.query(CalendarEvent).filter(CalendarEvent.user_id == user.id)
    if start:
        q = q.filter(CalendarEvent.starts_at >= start)
    if end:
        q = q.filter(CalendarEvent.starts_at <= end)
    return q.order_by(CalendarEvent.starts_at).all()


@router.post("", response_model=CalendarEventOut, status_code=201)
def create_event(
    payload: CalendarEventIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CalendarEvent:
    event = CalendarEvent(user_id=user.id, **payload.model_dump())
    db.add(event)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "calendar_event",
        f"Added event: {event.title}",
        entity_id=event.id,
        occurred_at=event.starts_at,
        group_key=f"event:{event.id}",
        meta={"all_day": event.all_day},
    )
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=CalendarEventOut)
def get_event(
    event_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CalendarEvent:
    return _get_event(db, event_id, user)


@router.patch("/{event_id}", response_model=CalendarEventOut)
def update_event(
    event_id: uuid.UUID,
    payload: CalendarEventUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CalendarEvent:
    event = _get_event(db, event_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    event = _get_event(db, event_id, user)
    db.delete(event)
    db.commit()
