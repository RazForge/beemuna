import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Habit, HabitCompletion
from app.models.user import User
from app.schemas.productivity import (
    HabitCompletionOut,
    HabitIn,
    HabitOut,
    HabitUpdate,
)
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/habits", tags=["habits"])


def _get_habit(db: OrmSession, habit_id: uuid.UUID, user: User) -> Habit:
    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


@router.get("", response_model=list[HabitOut])
def list_habits(
    active: bool | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Habit]:
    q = db.query(Habit).filter(Habit.user_id == user.id)
    if active is not None:
        q = q.filter(Habit.active == active)
    return q.order_by(Habit.created_at.desc()).all()


@router.post("", response_model=HabitOut, status_code=201)
def create_habit(
    payload: HabitIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Habit:
    habit = Habit(user_id=user.id, **payload.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.get("/{habit_id}", response_model=HabitOut)
def get_habit(
    habit_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Habit:
    return _get_habit(db, habit_id, user)


@router.patch("/{habit_id}", response_model=HabitOut)
def update_habit(
    habit_id: uuid.UUID,
    payload: HabitUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Habit:
    habit = _get_habit(db, habit_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(habit, field, value)
    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
def delete_habit(
    habit_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    habit = _get_habit(db, habit_id, user)
    db.delete(habit)
    db.commit()


# ── Completions ───────────────────────────────────────────────────────────────

@router.get("/{habit_id}/completions", response_model=list[HabitCompletionOut])
def list_completions(
    habit_id: uuid.UUID,
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[HabitCompletion]:
    _get_habit(db, habit_id, user)
    q = db.query(HabitCompletion).filter(HabitCompletion.habit_id == habit_id)
    if start:
        q = q.filter(HabitCompletion.completed_on >= start)
    if end:
        q = q.filter(HabitCompletion.completed_on <= end)
    return q.order_by(HabitCompletion.completed_on).all()


@router.post("/{habit_id}/completions", response_model=HabitCompletionOut, status_code=201)
def complete_habit(
    habit_id: uuid.UUID,
    completed_on: date = Query(default_factory=lambda: date.today()),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> HabitCompletion:
    habit = _get_habit(db, habit_id, user)
    existing = (
        db.query(HabitCompletion)
        .filter(
            HabitCompletion.habit_id == habit_id,
            HabitCompletion.completed_on == completed_on,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Habit already completed on this day")
    completion = HabitCompletion(
        user_id=user.id, habit_id=habit_id, completed_on=completed_on
    )
    db.add(completion)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "habit",
        f"Completed habit: {habit.name}",
        entity_id=habit.id,
        occurred_at=datetime.combine(completed_on, date.min.time(), tzinfo=UTC),
        group_key=f"habit:{habit.id}",
        meta={"completed_on": completed_on.isoformat()},
    )
    db.commit()
    db.refresh(completion)
    return completion


@router.delete("/{habit_id}/completions/{completed_on}", status_code=204)
def uncomplete_habit(
    habit_id: uuid.UUID,
    completed_on: date,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _get_habit(db, habit_id, user)
    completion = db.query(HabitCompletion).filter(
        HabitCompletion.habit_id == habit_id,
        HabitCompletion.completed_on == completed_on,
    ).first()
    if not completion:
        raise HTTPException(status_code=404, detail="Completion not found")
    db.delete(completion)
    db.commit()
