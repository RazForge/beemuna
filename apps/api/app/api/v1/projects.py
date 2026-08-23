import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, case, select
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Project, ProjectBlock, Task
from app.models.user import User
from app.schemas.productivity import ProjectBlockIn, ProjectBlockOut, ProjectBlockUpdate, ProjectIn, ProjectOut, ProjectUpdate
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_project(db: OrmSession, project_id: uuid.UUID, user: User) -> Project:
    project = db.query(Project).filter(
        Project.id == project_id, Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(
    archived: bool = False,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Project]:
    task_stats = (
        select(
            Task.project_id,
            func.count(Task.id).label("task_count"),
            func.count(case((Task.status == "completed", 1))).label("completed_count"),
        )
        .where(Task.user_id == user.id)
        .group_by(Task.project_id)
        .subquery()
    )

    stmt = (
        select(Project, task_stats.c.task_count, task_stats.c.completed_count)
        .outerjoin(task_stats, Project.id == task_stats.c.project_id)
        .where(Project.user_id == user.id, Project.archived == archived)
        .order_by(Project.created_at.desc())
    )
    rows = db.execute(stmt).all()
    result = []
    for project, task_count, completed_count in rows:
        tc = task_count or 0
        cc = completed_count or 0
        result.append(
            ProjectOut(
                id=project.id,
                name=project.name,
                description=project.description,
                color=project.color,
                status=project.status,
                archived=project.archived,
                created_at=project.created_at,
                updated_at=project.updated_at,
                task_count=tc,
                completed_count=cc,
                progress=int((cc / tc) * 100) if tc else 0,
            )
        )
    return result


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    project = Project(user_id=user.id, **payload.model_dump())
    db.add(project)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "project",
        f"Created project: {project.name}",
        entity_id=project.id,
        meta={"color": project.color},
    )
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectOut:
    project = _get_project(db, project_id, user)
    task_count = db.query(Task).filter(Task.project_id == project_id).count()
    completed_count = db.query(Task).filter(Task.project_id == project_id, Task.status == "completed").count()
    progress = int((completed_count / task_count) * 100) if task_count else 0
    return ProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        color=project.color,
        status=project.status,
        archived=project.archived,
        created_at=project.created_at,
        updated_at=project.updated_at,
        task_count=task_count,
        completed_count=completed_count,
        progress=progress,
    )


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Project:
    project = _get_project(db, project_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    project = _get_project(db, project_id, user)
    db.delete(project)
    db.commit()


# ── Project blocks ────────────────────────────────────────────────────────────

@router.get("/{project_id}/blocks", response_model=list[ProjectBlockOut])
def list_blocks(
    project_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ProjectBlock]:
    _get_project(db, project_id, user)
    return (
        db.query(ProjectBlock)
        .filter(ProjectBlock.project_id == project_id, ProjectBlock.user_id == user.id)
        .order_by(ProjectBlock.sort_order, ProjectBlock.created_at)
        .all()
    )


@router.post("/{project_id}/blocks", response_model=ProjectBlockOut, status_code=201)
def create_block(
    project_id: uuid.UUID,
    payload: ProjectBlockIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectBlock:
    _get_project(db, project_id, user)
    block = ProjectBlock(
        user_id=user.id,
        project_id=project_id,
        **payload.model_dump(),
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@router.patch("/blocks/{block_id}", response_model=ProjectBlockOut)
def update_block(
    block_id: uuid.UUID,
    payload: ProjectBlockUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ProjectBlock:
    block = db.query(ProjectBlock).filter(
        ProjectBlock.id == block_id, ProjectBlock.user_id == user.id
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(block, field, value)
    db.commit()
    db.refresh(block)
    return block


@router.delete("/blocks/{block_id}", status_code=204)
def delete_block(
    block_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    block = db.query(ProjectBlock).filter(
        ProjectBlock.id == block_id, ProjectBlock.user_id == user.id
    ).first()
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
    db.delete(block)
    db.commit()
