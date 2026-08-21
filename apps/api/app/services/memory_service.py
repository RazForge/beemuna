import uuid
import logging

from sqlalchemy.orm import Session as OrmSession

from app.models.memory import AIMemory

logger = logging.getLogger(__name__)


def get_relevant_memories(
    db: OrmSession,
    user_id: uuid.UUID,
    query: str,
    limit: int = 5,
) -> list[str]:
    """Return relevant memory content strings for the given query."""
    memories = (
        db.query(AIMemory)
        .filter(AIMemory.user_id == user_id)
        .order_by(AIMemory.importance.desc(), AIMemory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [m.content for m in memories if m.content.strip()]


def create_memory(
    db: OrmSession,
    user_id: uuid.UUID,
    content: str,
    category: str = "fact",
    source: str = "user",
    importance: float = 0.5,
    tags: list | None = None,
) -> AIMemory:
    memory = AIMemory(
        user_id=user_id,
        content=content,
        category=category,
        source=source,
        importance=importance,
        tags=tags or [],
    )
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def update_memory(
    db: OrmSession,
    memory_id: uuid.UUID,
    user_id: uuid.UUID,
    content: str | None = None,
    category: str | None = None,
    importance: float | None = None,
) -> AIMemory | None:
    memory = db.query(AIMemory).filter(
        AIMemory.id == memory_id, AIMemory.user_id == user_id
    ).first()
    if not memory:
        return None
    if content is not None:
        memory.content = content
    if category is not None:
        memory.category = category
    if importance is not None:
        memory.importance = importance
    db.commit()
    db.refresh(memory)
    return memory


def delete_memory(db: OrmSession, memory_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    memory = db.query(AIMemory).filter(
        AIMemory.id == memory_id, AIMemory.user_id == user_id
    ).first()
    if not memory:
        return False
    db.delete(memory)
    db.commit()
    return True


def clear_memories(db: OrmSession, user_id: uuid.UUID) -> int:
    count = db.query(AIMemory).filter(AIMemory.user_id == user_id).delete()
    db.commit()
    return count


def list_memories(db: OrmSession, user_id: uuid.UUID) -> list[AIMemory]:
    return (
        db.query(AIMemory)
        .filter(AIMemory.user_id == user_id)
        .order_by(AIMemory.created_at.desc())
        .all()
    )
