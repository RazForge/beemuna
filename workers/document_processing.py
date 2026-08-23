import uuid
from pathlib import Path

from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models.knowledge import DocumentChunk, Source
from app.services.document_processor import (
    chunk_text,
    extract_text,
    rough_token_count,
)
from app.services.embedding_service import embed_chunks


def process_source(db: OrmSession, source_id: uuid.UUID) -> str:
    source = db.get(Source, source_id)
    if not source:
        return "source_missing"

    if source.status in ("ready", "empty"):
        try:
            embed_chunks(db, source.user_id, source.knowledge_space_id, source.id)
            source.meta = {**(source.meta or {}), "embedded": True}
            db.commit()
            return "embedded"
        except Exception as exc:
            source.meta = {**(source.meta or {}), "embedded": False, "embed_error": str(exc)[:500]}
            db.commit()
            return "embed_failed"

    if source.status not in ("uploading", "processing", "error"):
        return "skipped"

    if not source.storage_path:
        source.status = "error"
        source.error_message = "No stored file to process"
        db.commit()
        return "error"

    file_path = Path(settings.upload_dir) / source.storage_path
    if not file_path.exists():
        source.status = "error"
        source.error_message = "Stored file missing"
        db.commit()
        return "error"

    try:
        data = file_path.read_bytes()
        raw = extract_text(source.filename or file_path.name, data)
        chunks = chunk_text(raw)
        source.status = "processing"
        db.flush()

        for chunk in db.query(DocumentChunk).filter(
            DocumentChunk.source_id == source.id,
            DocumentChunk.knowledge_space_id == source.knowledge_space_id,
            DocumentChunk.user_id == source.user_id,
        ):
            db.delete(chunk)
        db.flush()

        for i, text_chunk in enumerate(chunks):
            db.add(
                DocumentChunk(
                    user_id=source.user_id,
                    knowledge_space_id=source.knowledge_space_id,
                    source_id=source.id,
                    chunk_index=i,
                    content=text_chunk,
                    token_count=rough_token_count(text_chunk),
                )
            )
        db.flush()

        if not chunks:
            source.status = "empty"
            source.error_message = "No readable text extracted"
            db.commit()
            return "empty"

        source.status = "ready"
        source.error_message = None
        db.commit()

        try:
            embed_chunks(db, source.user_id, source.knowledge_space_id, source.id)
            source.meta = {**(source.meta or {}), "embedded": True}
            db.commit()
        except Exception as exc:
            source.meta = {**(source.meta or {}), "embedded": False, "embed_error": str(exc)[:500]}
            db.commit()
        return "ready"
    except Exception as exc:
        source.status = "error"
        source.error_message = str(exc)[:2000]
        db.commit()
        return "error"


def run_pending_documents(db: OrmSession, limit: int = 20) -> int:
    pending = (
        db.query(Source)
        .filter(Source.status.in_(["uploading", "processing", "error"]))
        .order_by(Source.updated_at)
        .limit(limit)
        .all()
    )
    results = 0
    for source in pending:
        process_source(db, source.id)
        results += 1
    return results
