import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.reminders import Notification, Reminder
from app.models.user import User
from app.schemas.reminders import (
    NotificationOut,
    ReminderIn,
    ReminderOut,
    ReminderUpdate,
)

router = APIRouter(prefix="/reminders", tags=["reminders"])


def _get_reminder(db: OrmSession, reminder_id: uuid.UUID, user: User) -> Reminder:
    reminder = db.query(Reminder).filter(
        Reminder.id == reminder_id, Reminder.user_id == user.id
    ).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return reminder


# ── Reminders Endpoints ───────────────────────────────────────────────────────

@router.get("", response_model=list[ReminderOut])
def list_reminders(
    status: str | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Reminder]:
    q = db.query(Reminder).filter(Reminder.user_id == user.id)
    if status:
        q = q.filter(Reminder.status == status)
    return q.order_by(Reminder.scheduled_at).all()


@router.post("", response_model=ReminderOut, status_code=201)
def create_reminder(
    payload: ReminderIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Reminder:
    reminder = Reminder(user_id=user.id, **payload.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.patch("/{reminder_id}", response_model=ReminderOut)
def update_reminder(
    reminder_id: uuid.UUID,
    payload: ReminderUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Reminder:
    reminder = _get_reminder(db, reminder_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder


@router.post("/{reminder_id}/snooze", response_model=ReminderOut)
def snooze_reminder(
    reminder_id: uuid.UUID,
    minutes: int = Query(default=15, ge=1, le=1440),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Reminder:
    reminder = _get_reminder(db, reminder_id, user)
    reminder.snoozed_until = datetime.now(UTC) + timedelta(minutes=minutes)
    reminder.status = "scheduled"
    db.commit()
    db.refresh(reminder)
    return reminder


@router.delete("/{reminder_id}", status_code=204)
def delete_reminder(
    reminder_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    reminder = _get_reminder(db, reminder_id, user)
    db.delete(reminder)
    db.commit()


# ── Notifications Endpoints ───────────────────────────────────────────────────

@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Notification]:
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    return q.order_by(Notification.created_at.desc()).limit(limit).all()


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_read(
    notification_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Notification:
    notif = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if not notif.read_at:
        notif.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(notif)
    return notif


@router.post("/notifications/read-all", status_code=200)
def mark_all_read(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    now = datetime.now(UTC)
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .update({"read_at": now}, synchronize_session=False)
    )
    db.commit()
    return {"marked_read": updated}
