"""Recurring task scheduler.

Processes recurrence_rule fields on tasks to generate next occurrences.
Supported rules: daily, weekly, monthly, yearly, or cron-like patterns.
"""

import uuid
import logging
from datetime import UTC, datetime, timedelta, date

from sqlalchemy.orm import Session as OrmSession

from app.models.productivity import Task

logger = logging.getLogger(__name__)

FREQUENCY_MAP = {
    "daily": timedelta(days=1),
    "weekly": timedelta(weeks=1),
    "biweekly": timedelta(weeks=2),
    "monthly": None,  # handled specially
    "yearly": None,  # handled specially
    "weekdays": None,  # handled specially
}


def _next_month(dt: date) -> date:
    if dt.month == 12:
        return date(dt.year + 1, 1, dt.day)
    next_m = dt.month + 1
    max_day = date(dt.year, next_m + 1, 1).day if next_m < 12 else 31
    return date(dt.year, next_m, min(dt.day, max_day))


def _next_year(dt: date) -> date:
    try:
        return date(dt.year + 1, dt.month, dt.day)
    except ValueError:
        return date(dt.year + 1, dt.month, 28)


ADVANCE_MAP = {
    "monthly": _next_month,
    "yearly": _next_year,
}


def compute_next_due(due_at: datetime, rule: str) -> datetime | None:
    """Compute the next due date based on a recurrence rule."""
    rule = rule.strip().lower()

    if rule == "weekdays":
        next_day = due_at + timedelta(days=1)
        while next_day.weekday() >= 5:
            next_day += timedelta(days=1)
        return next_day.replace(hour=due_at.hour, minute=due_at.minute, second=0, microsecond=0)

    if rule in FREQUENCY_MAP:
        delta = FREQUENCY_MAP[rule]
        if delta:
            return due_at + delta
        advancer = ADVANCE_MAP.get(rule)
        if advancer:
            return datetime.combine(advancer(due_at.date()), due_at.time(), tzinfo=due_at.tzinfo)

    return None


def process_recurring_tasks(db: OrmSession) -> int:
    """Find completed tasks with recurrence rules and create next instances."""
    now = datetime.now(UTC)
    created = 0

    recurring = (
        db.query(Task)
        .filter(
            Task.recurrence_rule.isnot(None),
            Task.recurrence_rule != "",
            Task.status == "completed",
            Task.completed_at.isnot(None),
        )
        .all()
    )

    for task in recurring:
        next_due = compute_next_due(task.completed_at, task.recurrence_rule)
        if not next_due or next_due < now:
            continue

        existing = (
            db.query(Task)
            .filter(
                Task.user_id == task.user_id,
                Task.title == task.title,
                Task.recurrence_rule == task.recurrence_rule,
                Task.status != "completed",
                Task.due_at == next_due,
            )
            .first()
        )
        if existing:
            continue

        new_task = Task(
            user_id=task.user_id,
            project_id=task.project_id,
            goal_id=task.goal_id,
            title=task.title,
            description=task.description,
            priority=task.priority,
            status="inbox",
            due_at=next_due,
            start_at=task.start_at,
            recurrence_rule=task.recurrence_rule,
            estimated_minutes=task.estimated_minutes,
            tags=task.tags or [],
        )
        db.add(new_task)
        created += 1

    if created:
        db.commit()
        logger.info(f"Created {created} recurring tasks")

    return created
