"""Journey API — achievements, progress paths, life score, AI engine."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.journey import Achievement, LifeScore, ProgressPath
from app.models.user import User
from app.services.journey_service import (
    check_and_unlock,
    compute_life_score,
    init_default_paths,
    update_progress_paths,
)
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/journey", tags=["journey"])


@router.get("/achievements")
def list_achievements(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """List all achievements with unlock status."""
    all_achievements = (
        db.query(Achievement)
        .filter(Achievement.user_id == user.id)
        .order_by(Achievement.unlocked_at.desc())
        .all()
    )

    unlocked = [a for a in all_achievements]
    total_points = sum(a.points for a in unlocked)

    return {
        "achievements": [
            {
                "id": str(a.id),
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "badge_color": a.badge_color,
                "category": a.category,
                "tier": a.tier,
                "points": a.points,
                "unlocked_at": a.unlocked_at.isoformat(),
                "seen": a.seen,
            }
            for a in unlocked
        ],
        "total_points": total_points,
        "total_unlocked": len(unlocked),
    }


@router.post("/achievements/check")
def check_achievements(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Run the achievement engine and return any newly unlocked."""
    newly = check_and_unlock(db, user.id)
    for a in newly:
        add_timeline_item(
            db, user.id, "achievement",
            f"Achievement unlocked: {a.name}",
            entity_id=a.id,
            occurred_at=a.unlocked_at,
            meta={"badge": a.icon, "tier": a.tier, "points": a.points},
        )
    db.commit()
    return {
        "newly_unlocked": [
            {
                "name": a.name,
                "description": a.description,
                "icon": a.icon,
                "tier": a.tier,
                "points": a.points,
            }
            for a in newly
        ],
        "count": len(newly),
    }


@router.patch("/achievements/{achievement_id}/seen")
def mark_seen(
    achievement_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    a = db.query(Achievement).filter(
        Achievement.id == achievement_id, Achievement.user_id == user.id
    ).first()
    if a:
        a.seen = True
        db.commit()
    return {"ok": True}


@router.get("/paths")
def list_paths(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    """List progress paths with current stage."""
    paths = init_default_paths(db, user.id)
    paths = update_progress_paths(db, user.id)

    result = []
    for p in paths:
        stages = p.stages or []
        current_stage = stages[p.current_stage_index] if p.current_stage_index < len(stages) else None
        progress_pct = (
            round((p.current_stage_index + 1) / len(stages) * 100) if stages else 0
        )

        result.append({
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "icon": p.icon,
            "category": p.category,
            "current_stage": current_stage,
            "current_stage_index": p.current_stage_index,
            "total_stages": len(stages),
            "progress_pct": progress_pct,
            "completed": p.completed,
            "stages": [
                {
                    "name": s["name"],
                    "desc": s.get("desc", ""),
                    "icon": s.get("icon", ""),
                    "threshold": s.get("threshold", 0),
                    "reached": i <= p.current_stage_index,
                }
                for i, s in enumerate(stages)
            ],
        })

    return result


@router.get("/life-score")
def get_life_score(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get or compute the current life score."""
    return compute_life_score(db, user.id)


@router.get("/timeline")
def journey_timeline(
    limit: int = Query(default=50, le=200),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get the combined journey timeline (achievements + path completions)."""
    from app.models.timeline import TimelineItem

    items = (
        db.query(TimelineItem)
        .filter(TimelineItem.user_id == user.id)
        .order_by(TimelineItem.occurred_at.desc())
        .limit(limit)
        .all()
    )

    achievements = (
        db.query(Achievement)
        .filter(Achievement.user_id == user.id)
        .order_by(Achievement.unlocked_at.desc())
        .limit(20)
        .all()
    )

    return {
        "timeline": [
            {
                "id": str(t.id),
                "type": t.entity_type,
                "title": t.title,
                "occurred_at": t.occurred_at.isoformat() if t.occurred_at else None,
                "meta": t.meta or {},
            }
            for t in items
        ],
        "recent_achievements": [
            {
                "name": a.name,
                "icon": a.icon,
                "tier": a.tier,
                "unlocked_at": a.unlocked_at.isoformat(),
            }
            for a in achievements
        ],
    }
