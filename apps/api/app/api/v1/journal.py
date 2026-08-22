import uuid
from datetime import date, datetime, time, timezone, timedelta
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import JournalEntry
from app.models.user import User
from app.schemas.productivity import JournalEntryIn, JournalEntryOut, JournalEntryUpdate
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/journal", tags=["journal"])


def _get_entry(db: OrmSession, entry_id: uuid.UUID, user: User) -> JournalEntry:
    entry = db.query(JournalEntry).filter(
        JournalEntry.id == entry_id, JournalEntry.user_id == user.id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.get("", response_model=list[JournalEntryOut])
def list_entries(
    month: int | None = Query(default=None, ge=1, le=12),
    year: int | None = Query(default=None, ge=1900),
    entry_date: date | None = Query(default=None),
    favorite: bool | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[JournalEntry]:
    q = db.query(JournalEntry).filter(JournalEntry.user_id == user.id)
    if entry_date is not None:
        q = q.filter(JournalEntry.entry_date == entry_date)
    elif month is not None and year is not None:
        q = q.filter(
            JournalEntry.entry_date >= date(year, month, 1),
            JournalEntry.entry_date < (
                date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
            ),
        )
    if favorite is not None:
        q = q.filter(JournalEntry.favorite == favorite)
    return q.order_by(JournalEntry.entry_date.desc(), JournalEntry.created_at.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=JournalEntryOut, status_code=201)
def create_entry(
    payload: JournalEntryIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JournalEntry:
    entry = JournalEntry(user_id=user.id, **payload.model_dump())
    db.add(entry)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "journal",
        entry.title or f"Journal entry for {entry.entry_date.isoformat()}",
        entity_id=entry.id,
        occurred_at=datetime.combine(entry.entry_date, time.min, tzinfo=timezone.utc),
        group_key=f"date:{entry.entry_date.isoformat()}",
        meta={"mood": entry.mood, "private": entry.private},
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=JournalEntryOut)
def get_entry(
    entry_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JournalEntry:
    return _get_entry(db, entry_id, user)


@router.patch("/{entry_id}", response_model=JournalEntryOut)
def update_entry(
    entry_id: uuid.UUID,
    payload: JournalEntryUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> JournalEntry:
    entry = _get_entry(db, entry_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    entry.version += 1
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    entry = _get_entry(db, entry_id, user)
    db.delete(entry)
    db.commit()


@router.get("/search", response_model=list[JournalEntryOut])
def search_entries(
    q: str = Query(..., min_length=2, max_length=200),
    limit: int = Query(default=20, le=50),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[JournalEntry]:
    """Search journal entries by content or title."""
    pattern = f"%{q}%"
    return (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == user.id,
            (JournalEntry.content.ilike(pattern)) | (JournalEntry.title.ilike(pattern)),
        )
        .order_by(JournalEntry.entry_date.desc())
        .limit(limit)
        .all()
    )


@router.get("/mood/analytics")
def mood_analytics(
    days: int = Query(default=30, le=365),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get mood trend analytics for the last N days."""
    since = date.today() - timedelta(days=days)
    entries = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == user.id,
            JournalEntry.entry_date >= since,
            JournalEntry.mood.isnot(None),
        )
        .all()
    )

    mood_counts = Counter()
    mood_by_week = {}
    total = 0
    mood_values = {"low": 1, "neutral": 2, "okay": 3, "good": 4, "great": 5}

    for e in entries:
        mood_counts[e.mood] += 1
        total += mood_values.get(e.mood, 3)
        week = e.entry_date.isocalendar()[1]
        key = f"W{week}"
        if key not in mood_by_week:
            mood_by_week[key] = Counter()
        mood_by_week[key][e.mood] += 1

    avg_mood = round(total / len(entries), 2) if entries else 0
    most_common = mood_counts.most_common(1)[0] if mood_counts else ("none", 0)

    weekly_trends = {}
    for week, counts in sorted(mood_by_week.items()):
        week_total = sum(counts.values())
        week_avg = sum(mood_values.get(m, 3) * c for m, c in counts.items()) / week_total
        weekly_trends[week] = {
            "avg_mood": round(week_avg, 2),
            "total_entries": week_total,
            "distribution": dict(counts),
        }

    return {
        "period_days": days,
        "total_entries": len(entries),
        "average_mood": avg_mood,
        "average_mood_label": max(mood_values, key=lambda k: abs(mood_values[k] - avg_mood)) if avg_mood else "none",
        "most_common_mood": most_common[0],
        "mood_distribution": dict(mood_counts),
        "weekly_trends": weekly_trends,
    }
