import logging
import uuid

from sqlalchemy.orm import Session as OrmSession

from app.models.knowledge import Source
from app.services.embedding_service import vector_search

logger = logging.getLogger(__name__)


def build_context(
    db: OrmSession,
    user_id: uuid.UUID,
    space_id: uuid.UUID | None,
    query: str,
    limit: int = 4,
) -> tuple[str, list[dict]]:
    if not space_id:
        return "", []

    pairs: list = []
    try:
        pairs = vector_search(db, user_id, space_id, query, limit)
    except Exception:
        logger.exception("RAG context build failed")
        return "", []

    source_ids = {chunk.source_id for chunk, _ in pairs}
    sources = {s.id: s for s in db.query(Source).filter(Source.id.in_(source_ids)).all()}

    context_parts: list[str] = []
    source_list: list[dict] = []
    for chunk, score in pairs:
        source = sources.get(chunk.source_id)
        if not source:
            continue
        context_parts.append(
            f"[source: {source.title} — score {score:.2f}]\n{chunk.content}"
        )
        source_list.append(
            {
                "id": str(chunk.id),
                "source_id": str(source.id),
                "source_title": source.title,
                "chunk_index": chunk.chunk_index,
                "score": round(score, 3),
                "excerpt": chunk.content[:300],
            }
        )
    return "\n\n".join(context_parts), source_list


def rag_system_prompt(context: str, religion: str = "other", mode: str = "assistant") -> str:
    base = (
        "You are BE'EMUNA, a thoughtful personal assistant for a "
        "faith-led productivity and knowledge platform. "
        "Answer warmly, clearly, and concisely. "
        "Format your responses using Markdown: use **bold** for emphasis, "
        "and use line breaks and bullet points for readability. "
        "Keep paragraphs short and scannable."
    )

    if religion == "christian":
        base += (
            " Align your guidance with Christian values. Use supportive language "
            "mentioning God, the Lord, Jesus Christ, or biblical principles where appropriate. "
            "Be an encouraging spiritual companion."
        )
    elif religion == "muslim":
        base += (
            " Align your guidance with Islamic values. Use supportive language "
            "mentioning Allah (SWT), the Prophet Mohammed (PBUH), the Quran, or Islamic "
            "principles where appropriate. Be a respectful and dedicated companion."
        )
    else:
        base += (
            " Maintain a professional, rational, and secular perspective. Focus on "
            "logic, evidence, and humanistic values. Be an objective and efficient assistant."
        )

    if mode == "research":
        base += (
            "\nYou are in research mode. Answer strictly from the provided context. "
            "If the context does not contain the answer, say so honestly."
        )
    elif mode == "journal":
        base += "\nYou are in reflection mode. Ask gentle questions and mirror the user's thoughts without judging."
    elif mode == "planner":
        base += "\nYou are in planner mode. Help structure tasks, priorities, and next actions."
    if context:
        base += f"\n\nContext from the user's knowledge space:\n\n{context}"
    return base