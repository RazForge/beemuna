"""Dashboard analytics endpoint."""

import uuid
from datetime import UTC, datetime, timedelta, date
from collections import Counter

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Task, Goal, Habit, HabitCompletion, FocusSession, Project
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def dashboard_analytics(
    days: int = Query(default=30, le=365),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get dashboard analytics for the last N days."""
    since = date.today() - timedelta(days=days)
    since_dt = datetime.combine(since, datetime.min.time()).replace(tzinfo=UTC)
    now = datetime.now(UTC)

    # Task stats
    total_tasks = db.query(func.count(Task.id)).filter(Task.user_id == user.id).scalar() or 0
    completed_tasks = (
        db.query(func.count(Task.id)).filter(
            Task.user_id == user.id,
            Task.status == "completed",
            Task.completed_at >= since_dt,
        ).scalar()
        or 0
    )
    pending_tasks = (
        db.query(func.count(Task.id)).filter(
            Task.user_id == user.id,
            Task.status.in_(["inbox", "in_progress", "pending"]),
        ).scalar()
        or 0
    )
    overdue_tasks = (
        db.query(func.count(Task.id)).filter(
            Task.user_id == user.id,
            Task.status.in_(["inbox", "in_progress", "pending"]),
            Task.due_at < now,
        ).scalar()
        or 0
    )

    # Task completion by day
    task_completions_by_day = {}
    for i in range(days):
        d = date.today() - timedelta(days=i)
        day_start = datetime.combine(d, datetime.min.time()).replace(tzinfo=UTC)
        day_end = datetime.combine(d, datetime.max.time()).replace(tzinfo=UTC)
        count = (
            db.query(func.count(Task.id)).filter(
                Task.user_id == user.id,
                Task.status == "completed",
                Task.completed_at >= day_start,
                Task.completed_at <= day_end,
            ).scalar()
            or 0
        )
        task_completions_by_day[d.isoformat()] = count

    # Habit stats
    active_habits = (
        db.query(func.count(Habit.id)).filter(
            Habit.user_id == user.id, Habit.active == True
        ).scalar()
        or 0
    )
    today_completions = (
        db.query(func.count(HabitCompletion.id)).filter(
            HabitCompletion.user_id == user.id,
            HabitCompletion.completed_on == date.today(),
        ).scalar()
        or 0
    )

    # Habit streaks
    habit_streaks = {}
    habits = db.query(Habit).filter(Habit.user_id == user.id, Habit.active == True).all()
    for h in habits:
        streak = 0
        check_date = date.today()
        while True:
            has = (
                db.query(HabitCompletion.id).filter(
                    HabitCompletion.habit_id == h.id,
                    HabitCompletion.completed_on == check_date,
                ).first()
            )
            if has:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        habit_streaks[h.name] = streak

    # Focus stats
    total_focus_minutes = (
        db.query(func.sum(FocusSession.elapsed_minutes)).filter(
            FocusSession.user_id == user.id,
            FocusSession.started_at >= since_dt,
        ).scalar()
        or 0
    )
    focus_sessions_count = (
        db.query(func.count(FocusSession.id)).filter(
            FocusSession.user_id == user.id,
            FocusSession.started_at >= since_dt,
        ).scalar()
        or 0
    )

    # Project stats
    active_projects = (
        db.query(func.count(Project.id)).filter(
            Project.user_id == user.id, Project.status == "active"
        ).scalar()
        or 0
    )

    # Goal stats
    active_goals = (
        db.query(func.count(Goal.id)).filter(
            Goal.user_id == user.id, Goal.status.in_(["active", "in_progress"])
        ).scalar()
        or 0
    )

    # Weekly summary
    weekly_data = []
    for week_offset in range(4):
        week_start = date.today() - timedelta(days=days - week_offset * 7)
        week_end = week_start + timedelta(days=6)
        ws = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=UTC)
        we = datetime.combine(week_end, datetime.max.time()).replace(tzinfo=UTC)
        week_completed = (
            db.query(func.count(Task.id)).filter(
                Task.user_id == user.id,
                Task.status == "completed",
                Task.completed_at >= ws,
                Task.completed_at <= we,
            ).scalar()
            or 0
        )
        week_focus = (
            db.query(func.sum(FocusSession.elapsed_minutes)).filter(
                FocusSession.user_id == user.id,
                FocusSession.started_at >= ws,
                FocusSession.started_at <= we,
            ).scalar()
            or 0
        )
        weekly_data.append({
            "week": f"W{week_offset + 1}",
            "start": week_start.isoformat(),
            "tasks_completed": week_completed,
            "focus_minutes": week_focus or 0,
        })

    return {
        "period_days": days,
        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "pending": pending_tasks,
            "overdue": overdue_tasks,
            "completion_rate": round(completed_tasks / max(total_tasks, 1) * 100, 1),
            "by_day": task_completions_by_day,
        },
        "habits": {
            "active": active_habits,
            "today_completed": today_completions,
            "streaks": habit_streaks,
        },
        "focus": {
            "total_minutes": total_focus_minutes,
            "sessions": focus_sessions_count,
            "avg_minutes": round(total_focus_minutes / max(focus_sessions_count, 1), 1),
        },
        "projects": {"active": active_projects},
        "goals": {"active": active_goals},
        "weekly": weekly_data,
    }
