import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.productivity import Note, NoteFolder
from app.models.user import User
from app.schemas.productivity import (
    NoteFolderIn,
    NoteFolderOut,
    NoteFolderUpdate,
    NoteIn,
    NoteOut,
    NoteUpdate,
)
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/notes", tags=["notes"])


def _get_note(db: OrmSession, note_id: uuid.UUID, user: User) -> Note:
    note = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


# ── Folders ───────────────────────────────────────────────────────────────────

@router.get("/folders", response_model=list[NoteFolderOut])
def list_folders(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[NoteFolder]:
    return (
        db.query(NoteFolder)
        .filter(NoteFolder.user_id == user.id)
        .order_by(NoteFolder.name)
        .all()
    )


@router.post("/folders", response_model=NoteFolderOut, status_code=201)
def create_folder(
    payload: NoteFolderIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NoteFolder:
    folder = NoteFolder(user_id=user.id, **payload.model_dump())
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return folder


@router.patch("/folders/{folder_id}", response_model=NoteFolderOut)
def update_folder(
    folder_id: uuid.UUID,
    payload: NoteFolderUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> NoteFolder:
    folder = db.query(NoteFolder).filter(
        NoteFolder.id == folder_id, NoteFolder.user_id == user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    db.commit()
    db.refresh(folder)
    return folder


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(
    folder_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    folder = db.query(NoteFolder).filter(
        NoteFolder.id == folder_id, NoteFolder.user_id == user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    db.delete(folder)
    db.commit()


# ── Notes ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[NoteOut])
def list_notes(
    folder_id: uuid.UUID | None = Query(default=None),
    favorite: bool | None = Query(default=None),
    archived: bool = Query(default=False),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Note]:
    q = db.query(Note).filter(Note.user_id == user.id, Note.archived == archived)
    if folder_id:
        q = q.filter(Note.folder_id == folder_id)
    if favorite is not None:
        q = q.filter(Note.favorite == favorite)
    return q.order_by(Note.updated_at.desc()).offset(offset).limit(limit).all()


@router.post("", response_model=NoteOut, status_code=201)
def create_note(
    payload: NoteIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Note:
    note = Note(user_id=user.id, **payload.model_dump())
    db.add(note)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "note",
        f"Created note: {note.title}",
        entity_id=note.id,
        meta={"folder_id": str(note.folder_id) if note.folder_id else None},
    )
    db.commit()
    db.refresh(note)
    return note


@router.get("/{note_id}", response_model=NoteOut)
def get_note(
    note_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Note:
    return _get_note(db, note_id, user)


@router.patch("/{note_id}", response_model=NoteOut)
def update_note(
    note_id: uuid.UUID,
    payload: NoteUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Note:
    note = _get_note(db, note_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    note.version += 1
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
def delete_note(
    note_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    note = _get_note(db, note_id, user)
    db.delete(note)
    db.commit()
