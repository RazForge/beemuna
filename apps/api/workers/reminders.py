import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models.reminders import Reminder
from app.models.user import User

logger = logging.getLogger(__name__)


def _is_quiet_hours(user: User, now: datetime) -> bool:
    local_now = now.astimezone(ZoneInfo(user.timezone or settings.default_timezone))
    current_minutes = local_now.hour * 60 + local_now.minute
    start = _parse_time(user.quiet_hours_start or settings.default_quiet_hours_start)
    end = _parse_time(user.quiet_hours_end or settings.default_quiet_hours_end)
    if start <= end:
        return start <= current_minutes < end
    return current_minutes >= start or current_minutes < end


def _parse_time(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _next_occurrence(reminder: Reminder) -> datetime | None:
    if reminder.recurrence_rule:
        try:
            delta = _parse_delta(reminder.recurrence_rule)
        except ValueError:
            return None
        next_at = reminder.scheduled_at + delta
        if next_at <= datetime.now(UTC):
            next_at = datetime.now(UTC) + timedelta(minutes=1)
        return next_at
    return None


def _parse_delta(rule: str) -> timedelta:
    if rule.startswith("every "):
        parts = rule.split()
        if len(parts) == 2:
            n = int(parts[1])
            return timedelta(minutes=n)
    raise ValueError(f"Unsupported recurrence rule: {rule}")


def process_due_reminders(db: OrmSession, now: datetime) -> list[Reminder]:
    due = (
        db.query(Reminder)
        .filter(Reminder.status == "scheduled", Reminder.scheduled_at <= now)
        .all()
    )
    results = []
    for reminder in due:
        user = db.get(User, reminder.user_id)
        if not user:
            continue
        if _is_quiet_hours(user, now) and not reminder.quiet_hours_ok:
            reminder.status = "snoozed"
            reminder.snoozed_until = now + timedelta(hours=1)
            db.add(reminder)
            continue

        reminder.status = "sent"
        db.add(reminder)

        next_at = _next_occurrence(reminder)
        if next_at is not None:
            new_reminder = Reminder(
                user_id=reminder.user_id,
                type=reminder.type,
                title=reminder.title,
                description=reminder.description,
                related_entity_type=reminder.related_entity_type,
                related_entity_id=reminder.related_entity_id,
                scheduled_at=next_at,
                timezone=reminder.timezone,
                recurrence_rule=reminder.recurrence_rule,
                status="scheduled",
                priority=reminder.priority,
                quiet_hours_ok=reminder.quiet_hours_ok,
                delivery_metadata=reminder.delivery_metadata,
            )
            db.add(new_reminder)

        results.append(reminder)
    db.commit()
    return results
