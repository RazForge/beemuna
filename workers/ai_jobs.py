import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models.knowledge import Source
from app.services.ai_service import chat_completion
from app.services.embedding_service import embed_chunks
from app.services.rag import build_context, rag_system_prompt


def embed_source(db: OrmSession, source_id: uuid.UUID) -> str:
    source = db.get(Source, source_id)
    if not source:
        return "source_missing"
    try:
        count = embed_chunks(db, source.user_id, source.knowledge_space_id, source.id)
        source.meta = {**(source.meta or {}), "embedded": True, "chunks_embedded": count}
        db.commit()
        return "embedded"
    except Exception as exc:
        source.meta = {**(source.meta or {}), "embedded": False, "embed_error": str(exc)[:500]}
        db.commit()
        return "embed_failed"


def ai_respond(
    db: OrmSession,
    user_id: uuid.UUID,
    space_id: uuid.UUID | None,
    prompt: str,
    mode: str = "assistant",
) -> str:
    from app.models.user import User
    user = db.get(User, user_id)
    religion = user.religion if user else "other"
    context, _ = build_context(db, user_id, space_id, prompt)
    system = rag_system_prompt(context, religion, mode)
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    return chat_completion(messages)


def embed_pending_sources(db: OrmSession, limit: int = 20) -> int:
    cooldown = datetime.now(UTC) - timedelta(minutes=10)
    pending = (
        db.query(Source)
        .filter(
            Source.status == "ready",
            Source.meta["embedded"].astext == "false",
            Source.updated_at < cooldown,
        )
        .order_by(Source.updated_at)
        .limit(limit)
        .all()
    )
    done = 0
    for source in pending:
        embed_source(db, source.id)
        done += 1
    return done
