import uuid
from datetime import UTC, datetime, timedelta, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import WeeklyReview
from app.models.user import User
from app.schemas.productivity import WeeklyReviewIn, WeeklyReviewOut
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/weekly-review", tags=["weekly-review"])


def _get_review(db: OrmSession, review_id: uuid.UUID, user: User) -> WeeklyReview:
    review = db.query(WeeklyReview).filter(
        WeeklyReview.id == review_id, WeeklyReview.user_id == user.id
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Weekly review not found")
    return review


@router.get("", response_model=WeeklyReviewOut)
def get_or_create_weekly_review(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WeeklyReview:
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    review = (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user.id, WeeklyReview.week_start == week_start)
        .first()
    )
    if not review:
        review = WeeklyReview(
            user_id=user.id,
            week_start=week_start,
            week_end=week_end,
        )
        db.add(review)
        db.commit()
        db.refresh(review)
    return review


@router.post("", response_model=WeeklyReviewOut, status_code=201)
def create_weekly_review(
    payload: WeeklyReviewIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WeeklyReview:
    week_start = payload.week_start
    week_end = week_start + timedelta(days=6)

    existing = (
        db.query(WeeklyReview)
        .filter(WeeklyReview.user_id == user.id, WeeklyReview.week_start == week_start)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Weekly review already exists for this week")

    review = WeeklyReview(
        user_id=user.id,
        week_start=week_start,
        week_end=week_end,
        tasks_completed=payload.tasks_completed,
        goals_advanced=payload.goals_advanced,
        habit_completion_pct=payload.habit_completion_pct,
        focus_hours=payload.focus_hours,
        achievements_earned=payload.achievements_earned,
        momentum_score=payload.momentum_score,
        ai_summary=payload.ai_summary,
        blockers=payload.blockers,
        wins=payload.wins,
        lessons=payload.lessons,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
