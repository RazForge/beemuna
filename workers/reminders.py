from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from app.models.reminders import Notification, Reminder
from app.models.user import User
from app.models.timeline import TimelineItem


def _is_quiet_hours(user: User, now: datetime) -> bool:
    try:
        start_h, start_m = map(int, user.quiet_hours_start.split(":"))
        end_h, end_m = map(int, user.quiet_hours_end.split(":"))
    except (ValueError, AttributeError):
        return False
    minutes = now.hour * 60 + now.minute
    start = start_h * 60 + start_m
    end = end_h * 60 + end_m
    if start == end:
        return False
    if start < end:
        return start <= minutes < end
    return minutes >= start or minutes < end


def _next_occurrence(now: datetime, rule: str) -> datetime | None:
    rule = (rule or "").lower()
    if rule == "daily":
        return now + timedelta(days=1)
    if rule == "hourly":
        return now + timedelta(hours=1)
    if rule in ("weekly", "every_week"):
        return now + timedelta(weeks=1)
    if rule in ("monthly", "every_month"):
        month = now.month + 1
        year = now.year + (month > 12)
        month = (month - 1) % 12 + 1
        day = min(now.day, 28)
        try:
            return now.replace(year=year, month=month, day=day)
        except ValueError:
            return None
    return None


def process_due_reminders(db: OrmSession) -> int:
    now = datetime.now(UTC)
    reminders = (
        db.query(Reminder)
        .filter(
            Reminder.status.in_(["scheduled", "sent"]),
            Reminder.scheduled_at <= now,
        )
        .order_by(Reminder.scheduled_at)
        .limit(500)
        .all()
    )

    processed = 0
    for reminder in reminders:
        if reminder.status == "scheduled":
            if reminder.snoozed_until and reminder.snoozed_until > now:
                continue
            user = db.get(User, reminder.user_id)
            if not user or user.deleted_at is not None:
                continue
            if _is_quiet_hours(user, now) and not reminder.quiet_hours_ok:
                continue

            notification = Notification(
                user_id=reminder.user_id,
                reminder_id=reminder.id,
                type=reminder.type,
                title=reminder.title,
                body=reminder.description,
                related_entity_type=reminder.related_entity_type,
                related_entity_id=reminder.related_entity_id,
                delivered_at=now,
                channel="in_app",
            )
            db.add(notification)
            reminder.status = "sent"
            reminder.delivery_metadata = {
                **(reminder.delivery_metadata or {}),
                "delivered_at": now.isoformat(),
            }

            recurring = _next_occurrence(now, reminder.recurrence_rule)
            if recurring:
                new_reminder = Reminder(
                    user_id=reminder.user_id,
                    type=reminder.type,
                    title=reminder.title,
                    description=reminder.description,
                    related_entity_type=reminder.related_entity_type,
                    related_entity_id=reminder.related_entity_id,
                    scheduled_at=recurring,
                    timezone=reminder.timezone,
                    recurrence_rule=reminder.recurrence_rule,
                    priority=reminder.priority,
                    quiet_hours_ok=reminder.quiet_hours_ok,
                )
                db.add(new_reminder)

            db.add(
                TimelineItem(
                    user_id=reminder.user_id,
                    entity_type="notification",
                    entity_id=notification.id,
                    title=f"Reminder: {reminder.title}",
                    occurred_at=now,
                    meta={"type": reminder.type},
                )
            )
            processed += 1
        elif reminder.status == "sent" and reminder.recurrence_rule:
            recurring = _next_occurrence(now, reminder.recurrence_rule)
            if recurring and not db.query(Reminder).filter(
                Reminder.user_id == reminder.user_id,
                Reminder.title == reminder.title,
                Reminder.scheduled_at == recurring,
            ).first():
                db.add(
                    Reminder(
                        user_id=reminder.user_id,
                        type=reminder.type,
                        title=reminder.title,
                        description=reminder.description,
                        related_entity_type=reminder.related_entity_type,
                        related_entity_id=reminder.related_entity_id,
                        scheduled_at=recurring,
                        timezone=reminder.timezone,
                        recurrence_rule=reminder.recurrence_rule,
                        priority=reminder.priority,
                        quiet_hours_ok=reminder.quiet_hours_ok,
                    )
                )
                processed += 1

    db.commit()
    return processed


def run_reminders_loop(db: OrmSession) -> int:
    return process_due_reminders(db)
