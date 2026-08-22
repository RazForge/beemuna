import uuid
from datetime import UTC, datetime
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Task, Subtask, FocusSession
from app.models.user import User
from app.schemas.productivity import (
    SubtaskIn,
    SubtaskOut,
    SubtaskUpdate,
    TaskBreakdownIn,
    TaskBreakdownOut,
    TaskIn,
    TaskOut,
    TaskUpdate,
    DependencyIn,
    HealthUpdateIn,
    FocusRecordIn,
)
from app.services.ai_service import chat_completion
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _get_task(db: OrmSession, task_id: uuid.UUID, user: User) -> Task:
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("", response_model=list[TaskOut])
def list_tasks(
    status: str | None = Query(default=None),
    priority: str | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    goal_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Task]:
    q = db.query(Task).filter(Task.user_id == user.id)
    if status:
        q = q.filter(Task.status == status)
    if priority:
        q = q.filter(Task.priority == priority)
    if project_id:
        q = q.filter(Task.project_id == project_id)
    if goal_id:
        q = q.filter(Task.goal_id == goal_id)
    return q.order_by(Task.sort_order, Task.created_at.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    payload: TaskIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = Task(user_id=user.id, **payload.model_dump())
    db.add(task)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "task",
        f"Created task: {task.title}",
        entity_id=task.id,
        meta={"priority": task.priority},
    )
    db.commit()
    db.refresh(task)
    return task


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    return _get_task(db, task_id, user)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = _get_task(db, task_id, user)
    data = payload.model_dump(exclude_unset=True)
    completed_now = False
    if data.get("status") == "done" and task.status != "done":
        data.setdefault("completed_at", datetime.now(UTC))
        completed_now = True
    elif data.get("status") and data["status"] != "done":
        data.setdefault("completed_at", None)
    for field, value in data.items():
        setattr(task, field, value)
    if completed_now:
        add_timeline_item(
            db,
            user.id,
            "task",
            f"Completed task: {task.title}",
            entity_id=task.id,
            occurred_at=data.get("completed_at") or datetime.now(UTC),
            meta={"priority": task.priority},
        )
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    task = _get_task(db, task_id, user)
    db.delete(task)
    db.commit()


# ── Subtasks ──────────────────────────────────────────────────────────────────

@router.get("/{task_id}/subtasks", response_model=list[SubtaskOut])
def list_subtasks(
    task_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Subtask]:
    _get_task(db, task_id, user)
    return (
        db.query(Subtask)
        .filter(Subtask.task_id == task_id)
        .order_by(Subtask.sort_order)
        .all()
    )


@router.post("/{task_id}/subtasks", response_model=SubtaskOut, status_code=201)
def create_subtask(
    task_id: uuid.UUID,
    payload: SubtaskIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Subtask:
    _get_task(db, task_id, user)
    subtask = Subtask(user_id=user.id, task_id=task_id, **payload.model_dump())
    db.add(subtask)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "subtask",
        f"Added subtask: {subtask.title}",
        entity_id=subtask.id,
        meta={"task_id": str(task_id)},
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@router.patch("/{task_id}/subtasks/{subtask_id}", response_model=SubtaskOut)
def update_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    payload: SubtaskUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Subtask:
    _get_task(db, task_id, user)
    subtask = db.query(Subtask).filter(
        Subtask.id == subtask_id, Subtask.task_id == task_id
    ).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("status") == "done" and subtask.status != "done":
        data.setdefault("completed_at", datetime.now(UTC))
    elif data.get("status") == "todo":
        data.setdefault("completed_at", None)
    for field, value in data.items():
        setattr(subtask, field, value)
    db.commit()
    db.refresh(subtask)
    return subtask


@router.delete("/{task_id}/subtasks/{subtask_id}", status_code=204)
def delete_subtask(
    task_id: uuid.UUID,
    subtask_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _get_task(db, task_id, user)
    subtask = db.query(Subtask).filter(
        Subtask.id == subtask_id, Subtask.task_id == task_id
    ).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    db.delete(subtask)
    db.commit()


# ── Productivity Engine 2.0 ───────────────────────────────────────────────────

@router.post("/{task_id}/breakdown", response_model=TaskBreakdownOut)
def generate_breakdown(
    task_id: uuid.UUID,
    payload: TaskBreakdownIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TaskBreakdownOut:
    task = _get_task(db, task_id, user)
    prompt = (
        f"Break down this task into 3-5 actionable subtasks. Return ONLY a JSON array of subtask descriptions.\n\n"
        f"Task: {task.title}\n"
        f"Description: {task.description or 'None'}\n"
        f"Context: {payload.context or 'None'}\n\n"
        f"Example: [\"Research requirements\", \"Draft plan\", \"Implement solution\"]"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.3)
    except Exception:
        reply = (
            "[Research and gather requirements, "
            "Plan and outline the approach, "
            "Implement the first part, "
            "Review and refine the work]"
        )

    subtasks_str = reply.strip()
    if subtasks_str.startswith("```"):
        subtasks_str = subtasks_str.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    try:
        subtasks = eval(subtasks_str)
        if not isinstance(subtasks, list):
            subtasks = [subtasks_str]
    except Exception:
        subtasks = [s.strip() for s in subtasks_str.split(",") if s.strip()]

    task.ai_breakdown = subtasks[:5]
    db.commit()
    db.refresh(task)
    return TaskBreakdownOut(task_id=task.id, subtasks=task.ai_breakdown)


@router.post("/{task_id}/dependencies", response_model=TaskOut)
def set_dependency(
    task_id: uuid.UUID,
    payload: DependencyIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = _get_task(db, task_id, user)
    if payload.depends_on_task_id == task_id:
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")
    dependency = db.query(Task).filter(
        Task.id == payload.depends_on_task_id,
        Task.user_id == user.id,
    ).first()
    if not dependency:
        raise HTTPException(status_code=404, detail="Dependency task not found")
    task.depends_on_task_id = payload.depends_on_task_id
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}/dependencies", response_model=TaskOut)
def remove_dependency(
    task_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = _get_task(db, task_id, user)
    task.depends_on_task_id = None
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}/health", response_model=TaskOut)
def update_health_status(
    task_id: uuid.UUID,
    payload: HealthUpdateIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = _get_task(db, task_id, user)
    task.health_status = payload.health_status
    if payload.health_status == "completed" and task.status != "done":
        task.status = "done"
        task.completed_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/focus", response_model=TaskOut)
def record_focus_session(
    task_id: uuid.UUID,
    payload: FocusRecordIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Task:
    task = _get_task(db, task_id, user)
    task.focus_session_count = (task.focus_session_count or 0) + 1
    task.total_focus_minutes = (task.total_focus_minutes or 0) + payload.minutes
    db.commit()
    db.refresh(task)
    return task
