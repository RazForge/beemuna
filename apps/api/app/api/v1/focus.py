import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import FocusSession
from app.models.user import User
from app.schemas.productivity import FocusSessionIn, FocusSessionOut, FocusSessionUpdate
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/focus", tags=["focus"])


def _get_session(db: OrmSession, session_id: uuid.UUID, user: User) -> FocusSession:
    session = db.query(FocusSession).filter(
        FocusSession.id == session_id, FocusSession.user_id == user.id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Focus session not found")
    return session


@router.get("", response_model=list[FocusSessionOut])
def list_sessions(
    status: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[FocusSession]:
    q = db.query(FocusSession).filter(FocusSession.user_id == user.id)
    if status:
        q = q.filter(FocusSession.status == status)
    return q.order_by(FocusSession.started_at.desc()).limit(limit).all()


@router.post("", response_model=FocusSessionOut, status_code=201)
def start_session(
    payload: FocusSessionIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FocusSession:
    session = FocusSession(
        user_id=user.id,
        started_at=datetime.now(UTC),
        remaining_seconds=payload.planned_minutes * 60,
        **payload.model_dump(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=FocusSessionOut)
def get_session(
    session_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FocusSession:
    return _get_session(db, session_id, user)


@router.patch("/{session_id}", response_model=FocusSessionOut)
def update_session(
    session_id: uuid.UUID,
    payload: FocusSessionUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FocusSession:
    session = _get_session(db, session_id, user)
    data = payload.model_dump(exclude_unset=True)

    now = datetime.now(UTC)
    completed_now = False
    if data.get("status") == "completed" and session.status != "completed":
        data["ended_at"] = now
        completed_now = True
        if session.started_at and not session.elapsed_minutes:
            data["elapsed_minutes"] = max(
                0, int((now - session.started_at).total_seconds() // 60)
            )
    elif data.get("status") == "paused" and session.status == "running":
        data["paused_at"] = now
    elif data.get("status") == "running":
        data["paused_at"] = None

    for field, value in data.items():
        setattr(session, field, value)
    if completed_now:
        add_timeline_item(
            db,
            user.id,
            "focus",
            f"Focus session completed ({session.elapsed_minutes}m)",
            entity_id=session.id,
            occurred_at=now,
            meta={"kind": session.kind, "planned": session.planned_minutes},
        )
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    session = _get_session(db, session_id, user)
    db.delete(session)
    db.commit()
