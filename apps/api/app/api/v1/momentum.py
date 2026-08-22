import uuid
from datetime import UTC, datetime, timedelta, date
from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Task, Goal, Habit, HabitCompletion, FocusSession, WeeklyReview
from app.models.user import User

router = APIRouter(prefix="/momentum", tags=["momentum"])


@router.get("")
def get_momentum_score(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    # Task completion rate (last 7 days)
    week_start_dt = datetime.combine(week_start, datetime.min.time()).replace(tzinfo=UTC)
    completed_this_week = (
        db.query(func.count(Task.id))
        .filter(Task.user_id == user.id, Task.status == "completed", Task.completed_at >= week_start_dt)
        .scalar()
        or 0
    )
    total_this_week = (
        db.query(func.count(Task.id))
        .filter(Task.user_id == user.id, Task.created_at >= week_start_dt)
        .scalar()
        or 0
    )
    task_component = (completed_this_week / max(total_this_week, 1)) * 25

    # Habit completion rate
    active_habits = (
        db.query(func.count(Habit.id))
        .filter(Habit.user_id == user.id, Habit.active == True)
        .scalar()
        or 0
    )
    habit_completions_this_week = (
        db.query(func.count(HabitCompletion.id))
        .filter(
            HabitCompletion.user_id == user.id,
            HabitCompletion.completed_on >= week_start,
        )
        .scalar()
        or 0
    )
    expected_completions = active_habits * 7
    habit_component = (habit_completions_this_week / max(expected_completions, 1)) * 25

    # Focus minutes (last 30 days)
    month_start_dt = datetime.combine(month_start, datetime.min.time()).replace(tzinfo=UTC)
    focus_minutes = (
        db.query(func.sum(FocusSession.elapsed_minutes))
        .filter(FocusSession.user_id == user.id, FocusSession.started_at >= month_start_dt)
        .scalar()
        or 0
    )
    focus_component = min(25, (focus_minutes / 60 / 40) * 25)  # 40h/month target

    # Goal progress
    active_goals = (
        db.query(func.count(Goal.id))
        .filter(Goal.user_id == user.id, Goal.status == "active")
        .scalar()
        or 0
    )
    avg_progress = (
        db.query(func.avg(Goal.progress_percent))
        .filter(Goal.user_id == user.id, Goal.status == "active")
        .scalar()
        or 0
    )
    goal_component = ((avg_progress or 0) / 100) * 25

    score = task_component + habit_component + focus_component + goal_component

    # Determine trend
    last_review = (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user.id)
        .order_by(WeeklyReview.week_start.desc())
        .first()
    )
    prev_review = (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user.id)
        .order_by(WeeklyReview.week_start.desc())
        .offset(1)
        .first()
    )

    trend = "stable"
    if last_review and prev_review:
        if last_review.momentum_score and prev_review.momentum_score:
            diff = last_review.momentum_score - prev_review.momentum_score
            if diff > 5:
                trend = "up"
            elif diff < -5:
                trend = "down"

    return {
        "score": round(score, 1),
        "trend": trend,
        "components": {
            "tasks": round(task_component, 1),
            "habits": round(habit_component, 1),
            "focus": round(focus_component, 1),
            "goals": round(goal_component, 1),
        },
    }
