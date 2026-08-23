import uuid

import httpx
from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models.knowledge import DocumentChunk, Embedding


def _ollama_embed(model: str, text: str) -> list[float]:
    url = f"{settings.ollama_url.rstrip('/')}/api/embed"
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            url,
            json={
                "model": model,
                "input": text,
                "keep_alive": settings.ollama_keep_alive,
                "options": {
                    "num_ctx": settings.ollama_num_ctx,
                    "num_threads": settings.ollama_num_threads,
                    "keep_alive": settings.ollama_keep_alive,
                },
            },
        )
        resp.raise_for_status()
        data = resp.json()
    embeds = data.get("embeddings") or []
    if not embeds:
        raise RuntimeError("Ollama returned no embeddings")
    return list(embeds[0])


def _openai_embed(model: str, text: str) -> list[float]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.ai_api_key or settings.openai_api_key, base_url=settings.ai_base_url or None)
    resp = client.embeddings.create(model=model, input=text)
    return list(resp.data[0].embedding)


def embed_text(provider: str | None, model: str | None, text: str) -> list[float]:
    provider = provider or settings.embedding_provider
    model = model or settings.embedding_model
    if provider in ("ollama", "ollama-compatible"):
        return _ollama_embed(model, text)
    if provider in ("openai", "openai-compatible"):
        return _openai_embed(model, text)
    raise ValueError(f"Unsupported embedding provider: {provider}")


def embed_chunks(db: OrmSession, user_id: uuid.UUID, space_id: uuid.UUID, source_id: uuid.UUID) -> int:
    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.knowledge_space_id == space_id,
            DocumentChunk.source_id == source_id,
            DocumentChunk.user_id == user_id,
        )
        .order_by(DocumentChunk.chunk_index)
        .all()
    )
    if not chunks:
        return 0
    model = settings.embedding_model
    chunk_ids = [chunk.id for chunk in chunks]
    db.execute(delete(Embedding).where(Embedding.chunk_id.in_(chunk_ids), Embedding.model == model))
    for chunk in chunks:
        vector = embed_text(None, None, chunk.content)
        embedding = Embedding(
            user_id=user_id,
            knowledge_space_id=space_id,
            chunk_id=chunk.id,
            model=model,
            dimensions=len(vector),
            vector=vector,
        )
        db.add(embedding)
    db.commit()
    return len(chunks)


def vector_search(
    db: OrmSession,
    user_id: uuid.UUID,
    space_id: uuid.UUID | None,
    query: str,
    limit: int = 5,
) -> list[tuple[DocumentChunk, float]]:
    vector = embed_text(None, None, query)
    sql = text(
        """
        SELECT c.id AS chunk_id,
               1 - (e.vector <=> :qvec) AS score
        FROM embeddings e
        JOIN document_chunks c ON c.id = e.chunk_id
        WHERE e.user_id = :uid
          AND (:space_id::uuid IS NULL OR e.knowledge_space_id = :space_id)
        ORDER BY e.vector <=> :qvec
        LIMIT :limit
        """
    )
    params = {
        "qvec": str(vector),
        "uid": str(user_id),
        "space_id": str(space_id) if space_id else None,
        "limit": limit,
    }
    rows = db.execute(sql, params).fetchall()

    results: list[tuple[DocumentChunk, float]] = []
    for row in rows:
        chunk = db.get(DocumentChunk, uuid.UUID(row.chunk_id))
        if chunk:
            results.append((chunk, float(row.score)))
    return results