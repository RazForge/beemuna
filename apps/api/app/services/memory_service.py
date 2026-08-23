import uuid
import logging
import re

from sqlalchemy.orm import Session as OrmSession

from app.models.memory import AIMemory

logger = logging.getLogger(__name__)

MEMORY_PATTERNS = [
    (r"(?:my name is|i'm called|i am) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)", "preference", 0.7),
    (r"(?:i live in|my city is|from) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)", "fact", 0.6),
    (r"(?:i work as|i'm a|my job is|my role is) (.+?)(?:\.|,|$)", "fact", 0.7),
    (r"(?:i prefer|i like|i love|i enjoy) (.+?)(?:\.|,|$)", "preference", 0.6),
    (r"(?:i don't like|i hate|i can't stand) (.+?)(?:\.|,|$)", "preference", 0.6),
    (r"(?:my birthday is|i was born on?) (.+?)(?:\.|,|$)", "fact", 0.8),
    (r"(?:i'm learning|i'm studying|i want to learn) (.+?)(?:\.|,|$)", "goal", 0.6),
    (r"(?:i'm reading|i'm currently reading|i read) (.+?)(?:\.|,|$)", "fact", 0.5),
    (r"(?:i'm working on|i'm building|i'm creating) (.+?)(?:\.|,|$)", "fact", 0.6),
    (r"(?:my goal is|i want to|i plan to) (.+?)(?:\.|,|$)", "goal", 0.7),
]


def extract_memories_from_conversation(
    db: OrmSession,
    user_id: uuid.UUID,
    user_message: str,
    assistant_reply: str,
) -> list[AIMemory]:
    """Extract factual memories from a conversation exchange."""
    extracted = []
    combined = f"{user_message} {assistant_reply}"

    for pattern, category, importance in MEMORY_PATTERNS:
        matches = re.finditer(pattern, combined, re.IGNORECASE)
        for match in matches:
            content = match.group(1).strip()
            if len(content) < 3 or len(content) > 200:
                continue
            existing = (
                db.query(AIMemory)
                .filter(AIMemory.user_id == user_id, AIMemory.content.ilike(f"%{content}%"))
                .first()
            )
            if existing:
                continue
            memory = create_memory(
                db, user_id, content, category=category, source="auto", importance=importance
            )
            extracted.append(memory)

    return extracted


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
