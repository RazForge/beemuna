import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Goal, Milestone
from app.models.user import User
from app.schemas.productivity import GoalIn, GoalOut, GoalUpdate, MilestoneIn, MilestoneOut, MilestoneUpdate
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/goals", tags=["goals"])


def _get_goal(db: OrmSession, goal_id: uuid.UUID, user: User) -> Goal:
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("", response_model=list[GoalOut])
def list_goals(
    status: str | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Goal]:
    q = db.query(Goal).filter(Goal.user_id == user.id)
    if status:
        q = q.filter(Goal.status == status)
    return q.order_by(Goal.created_at.desc()).all()


@router.post("", response_model=GoalOut, status_code=201)
def create_goal(
    payload: GoalIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Goal:
    goal = Goal(user_id=user.id, **payload.model_dump())
    db.add(goal)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "goal",
        f"Created goal: {goal.title}",
        entity_id=goal.id,
        meta={"status": goal.status},
    )
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Goal:
    return _get_goal(db, goal_id, user)


@router.patch("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: uuid.UUID,
    payload: GoalUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Goal:
    goal = _get_goal(db, goal_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    goal = _get_goal(db, goal_id, user)
    db.delete(goal)
    db.commit()


# ── Milestones ────────────────────────────────────────────────────────────────

@router.get("/{goal_id}/milestones", response_model=list[MilestoneOut])
def list_milestones(
    goal_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Milestone]:
    _get_goal(db, goal_id, user)
    return (
        db.query(Milestone)
        .filter(Milestone.goal_id == goal_id)
        .order_by(Milestone.threshold)
        .all()
    )


@router.post("/{goal_id}/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(
    goal_id: uuid.UUID,
    payload: MilestoneIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Milestone:
    _get_goal(db, goal_id, user)
    milestone = Milestone(user_id=user.id, goal_id=goal_id, **payload.model_dump())
    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.patch("/{goal_id}/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Milestone:
    _get_goal(db, goal_id, user)
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id, Milestone.goal_id == goal_id
    ).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("achieved") is True and not milestone.achieved:
        data.setdefault("achieved_at", datetime.now(UTC))
        add_timeline_item(
            db,
            user.id,
            "milestone",
            f"Milestone achieved: {milestone.title}",
            entity_id=milestone.id,
            occurred_at=data["achieved_at"],
            group_key=f"goal:{goal_id}",
            meta={"goal_id": str(goal_id), "threshold": milestone.threshold},
        )
    elif data.get("achieved") is False:
        data.setdefault("achieved_at", None)
    for field, value in data.items():
        setattr(milestone, field, value)
    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/{goal_id}/milestones/{milestone_id}", status_code=204)
def delete_milestone(
    goal_id: uuid.UUID,
    milestone_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _get_goal(db, goal_id, user)
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id, Milestone.goal_id == goal_id
    ).first()
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")
    db.delete(milestone)
    db.commit()
