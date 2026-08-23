import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.knowledge import (
    Citation,
    Concept,
    DocumentChunk,
    KnowledgeSpace,
    Relationship,
    Source,
)
from app.models.timeline import TimelineItem
from app.models.user import User
from app.schemas.knowledge import (
    CitationOut,
    ConceptIn,
    ConceptOut,
    ConceptUpdate,
    DocumentChunkOut,
    KnowledgeSpaceIn,
    KnowledgeSpaceOut,
    KnowledgeSpaceUpdate,
    RelationshipIn,
    RelationshipOut,
    SearchResult,
    SourceOut,
    SourceUpdate,
)
from app.services.document_processor import (
    SUPPORTED_EXTENSIONS,
    chunk_text,
    compute_checksum,
    extract_text,
    rough_token_count,
    save_upload,
)
from app.services.embedding_service import embed_chunks, vector_search
from app.services.timeline_service import add_timeline_item

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

MAX_UPLOAD = settings.max_upload_bytes


def _get_space(db: OrmSession, space_id: uuid.UUID, user: User) -> KnowledgeSpace:
    space = db.query(KnowledgeSpace).filter(
        KnowledgeSpace.id == space_id, KnowledgeSpace.user_id == user.id
    ).first()
    if not space:
        raise HTTPException(status_code=404, detail="Knowledge space not found")
    return space


def _get_source(db: OrmSession, space_id: uuid.UUID, source_id: uuid.UUID, user: User) -> Source:
    source = db.query(Source).filter(
        Source.id == source_id,
        Source.knowledge_space_id == space_id,
        Source.user_id == user.id,
    ).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


def _get_concept(db: OrmSession, space_id: uuid.UUID, concept_id: uuid.UUID, user: User) -> Concept:
    concept = db.query(Concept).filter(
        Concept.id == concept_id,
        Concept.knowledge_space_id == space_id,
        Concept.user_id == user.id,
    ).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")
    return concept


# ── Spaces ────────────────────────────────────────────────────────────────────

@router.get("/spaces", response_model=list[KnowledgeSpaceOut])
def list_spaces(
    archived: bool = False,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KnowledgeSpace]:
    return (
        db.query(KnowledgeSpace)
        .filter(KnowledgeSpace.user_id == user.id, KnowledgeSpace.archived == archived)
        .order_by(KnowledgeSpace.created_at.desc())
        .all()
    )


@router.post("/spaces", response_model=KnowledgeSpaceOut, status_code=201)
def create_space(
    payload: KnowledgeSpaceIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeSpace:
    space = KnowledgeSpace(user_id=user.id, **payload.model_dump())
    db.add(space)
    db.flush()
    add_timeline_item(
        db,
        user.id,
        "research",
        f"Created knowledge space: {space.name}",
        entity_id=space.id,
        meta={},
    )
    db.commit()
    db.refresh(space)
    return space


@router.get("/spaces/{space_id}", response_model=KnowledgeSpaceOut)
def get_space(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeSpace:
    return _get_space(db, space_id, user)


@router.patch("/spaces/{space_id}", response_model=KnowledgeSpaceOut)
def update_space(
    space_id: uuid.UUID,
    payload: KnowledgeSpaceUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KnowledgeSpace:
    space = _get_space(db, space_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(space, field, value)
    db.commit()
    db.refresh(space)
    return space


@router.delete("/spaces/{space_id}", status_code=204)
def delete_space(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    space = _get_space(db, space_id, user)
    db.delete(space)
    db.commit()


# ── Sources (JSON create / web URL) ───────────────────────────────────────────

@router.get("/spaces/{space_id}/sources", response_model=list[SourceOut])
def list_sources(
    space_id: uuid.UUID,
    status: str | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Source]:
    _get_space(db, space_id, user)
    q = db.query(Source).filter(
        Source.knowledge_space_id == space_id, Source.user_id == user.id
    )
    if status:
        q = q.filter(Source.status == status)
    return q.order_by(Source.created_at.desc()).all()


@router.post("/spaces/{space_id}/sources", response_model=SourceOut, status_code=201)
def create_source(
    space_id: uuid.UUID,
    title: str,
    web_url: str | None = Query(default=None, max_length=1000),
    source_type: str = Query(default="web", pattern="^(web|note|paste)$"),
    content: str | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Source:
    _get_space(db, space_id, user)
    source = Source(
        user_id=user.id,
        knowledge_space_id=space_id,
        type=source_type,
        title=title,
        web_url=web_url,
        status="ready",
    )
    db.add(source)
    db.flush()

    chunks = chunk_text(content or title)
    for i, text_chunk in enumerate(chunks):
        db.add(
            DocumentChunk(
                user_id=user.id,
                knowledge_space_id=space_id,
                source_id=source.id,
                chunk_index=i,
                content=text_chunk,
                token_count=rough_token_count(text_chunk),
            )
        )
    db.commit()
    db.refresh(source)
    return source


@router.post("/spaces/{space_id}/sources/upload", response_model=SourceOut, status_code=201)
async def upload_source(
    space_id: uuid.UUID,
    file: UploadFile = File(...),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Source:
    _get_space(db, space_id, user)
    ext = "." + (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=413, detail="File exceeds size limit")

    title = (file.filename or "Untitled").rsplit(".", 1)[0][:500]
    source = Source(
        user_id=user.id,
        knowledge_space_id=space_id,
        type=SUPPORTED_EXTENSIONS[ext],
        title=title,
        filename=file.filename,
        size_bytes=len(data),
        mime_type=file.content_type,
        checksum=compute_checksum(data),
        status="processing",
    )
    db.add(source)
    db.flush()

    try:
        raw = extract_text(file.filename or "doc.txt", data)
        chunks = chunk_text(raw)
        source.storage_path = save_upload(
            user.id, space_id, source.id, file.filename or "doc.txt", data, settings.upload_dir
        )
        for i, text_chunk in enumerate(chunks):
            db.add(
                DocumentChunk(
                    user_id=user.id,
                    knowledge_space_id=space_id,
                    source_id=source.id,
                    chunk_index=i,
                    content=text_chunk,
                    token_count=rough_token_count(text_chunk),
                )
            )
        if not chunks:
            source.status = "empty"
            source.error_message = "No readable text extracted"
        else:
            source.status = "ready"
    except Exception as exc:
        source.status = "error"
        source.error_message = str(exc)[:2000]

    if source.status == "ready":
        try:
            embed_chunks(db, user.id, space_id, source.id)
            source.meta = {**(source.meta or {}), "embedded": True}
        except Exception as exc:
            source.meta = {**(source.meta or {}), "embedded": False, "embed_error": str(exc)[:500]}

    add_timeline_item(
        db,
        user.id,
        "document",
        f"Added source: {source.title}",
        entity_id=source.id,
        meta={"type": source.type, "status": source.status},
    )
    db.commit()
    db.refresh(source)
    return source


@router.get("/spaces/{space_id}/sources/{source_id}", response_model=SourceOut)
def get_source(
    space_id: uuid.UUID,
    source_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Source:
    return _get_source(db, space_id, source_id, user)


@router.patch("/spaces/{space_id}/sources/{source_id}", response_model=SourceOut)
def update_source(
    space_id: uuid.UUID,
    source_id: uuid.UUID,
    payload: SourceUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Source:
    source = _get_source(db, space_id, source_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/spaces/{space_id}/sources/{source_id}", status_code=204)
def delete_source(
    space_id: uuid.UUID,
    source_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    source = _get_source(db, space_id, source_id, user)
    db.delete(source)
    db.commit()


@router.post("/spaces/{space_id}/sources/{source_id}/embed", response_model=SourceOut)
def reembed_source(
    space_id: uuid.UUID,
    source_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Source:
    source = _get_source(db, space_id, source_id, user)
    try:
        count = embed_chunks(db, user.id, space_id, source.id)
        source.meta = {**(source.meta or {}), "embedded": True, "chunks_embedded": count}
        source.status = "ready"
    except Exception as exc:
        source.meta = {**(source.meta or {}), "embedded": False, "embed_error": str(exc)[:500]}
    db.commit()
    db.refresh(source)
    return source


# ── Chunks ────────────────────────────────────────────────────────────────────

@router.get("/spaces/{space_id}/chunks", response_model=list[DocumentChunkOut])
def list_chunks(
    space_id: uuid.UUID,
    source_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DocumentChunk]:
    _get_space(db, space_id, user)
    q = db.query(DocumentChunk).filter(
        DocumentChunk.knowledge_space_id == space_id, DocumentChunk.user_id == user.id
    )
    if source_id:
        q = q.filter(DocumentChunk.source_id == source_id)
    return q.order_by(DocumentChunk.chunk_index).offset(offset).limit(limit).all()


# ── Concepts ──────────────────────────────────────────────────────────────────

@router.get("/spaces/{space_id}/concepts", response_model=list[ConceptOut])
def list_concepts(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Concept]:
    _get_space(db, space_id, user)
    return (
        db.query(Concept)
        .filter(Concept.knowledge_space_id == space_id, Concept.user_id == user.id)
        .order_by(Concept.confidence.desc(), Concept.name)
        .all()
    )


@router.post("/spaces/{space_id}/concepts", response_model=ConceptOut, status_code=201)
def create_concept(
    space_id: uuid.UUID,
    payload: ConceptIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Concept:
    _get_space(db, space_id, user)
    concept = Concept(user_id=user.id, knowledge_space_id=space_id, **payload.model_dump())
    db.add(concept)
    db.commit()
    db.refresh(concept)
    return concept


@router.get("/spaces/{space_id}/concepts/{concept_id}", response_model=ConceptOut)
def get_concept(
    space_id: uuid.UUID,
    concept_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Concept:
    return _get_concept(db, space_id, concept_id, user)


@router.patch("/spaces/{space_id}/concepts/{concept_id}", response_model=ConceptOut)
def update_concept(
    space_id: uuid.UUID,
    concept_id: uuid.UUID,
    payload: ConceptUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Concept:
    concept = _get_concept(db, space_id, concept_id, user)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(concept, field, value)
    db.commit()
    db.refresh(concept)
    return concept


@router.delete("/spaces/{space_id}/concepts/{concept_id}", status_code=204)
def delete_concept(
    space_id: uuid.UUID,
    concept_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    concept = _get_concept(db, space_id, concept_id, user)
    db.delete(concept)
    db.commit()


# ── Relationships ─────────────────────────────────────────────────────────────

@router.get("/spaces/{space_id}/relationships", response_model=list[RelationshipOut])
def list_relationships(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Relationship]:
    _get_space(db, space_id, user)
    return (
        db.query(Relationship)
        .filter(Relationship.knowledge_space_id == space_id, Relationship.user_id == user.id)
        .all()
    )


@router.post("/spaces/{space_id}/relationships", response_model=RelationshipOut, status_code=201)
def create_relationship(
    space_id: uuid.UUID,
    payload: RelationshipIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Relationship:
    _get_space(db, space_id, user)
    rel = Relationship(
        user_id=user.id,
        knowledge_space_id=space_id,
        **payload.model_dump(),
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return rel


@router.delete("/spaces/{space_id}/relationships/{rel_id}", status_code=204)
def delete_relationship(
    space_id: uuid.UUID,
    rel_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    _get_space(db, space_id, user)
    rel = db.query(Relationship).filter(
        Relationship.id == rel_id,
        Relationship.knowledge_space_id == space_id,
        Relationship.user_id == user.id,
    ).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(rel)
    db.commit()


# ── Citations ─────────────────────────────────────────────────────────────────

@router.get("/spaces/{space_id}/citations", response_model=list[CitationOut])
def list_citations(
    space_id: uuid.UUID,
    concept_id: uuid.UUID | None = Query(default=None),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Citation]:
    _get_space(db, space_id, user)
    q = db.query(Citation).filter(
        Citation.knowledge_space_id == space_id, Citation.user_id == user.id
    )
    if concept_id:
        q = q.filter(Citation.concept_id == concept_id)
    return q.order_by(Citation.created_at.desc()).all()


# ── Search ────────────────────────────────────────────────────────────────────

@router.get("/search", response_model=list[SearchResult])
def keyword_search(
    q: str = Query(min_length=1, max_length=300),
    space_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=10, le=50),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SearchResult]:
    results = []
    for chunk in (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.user_id == user.id,
            (space_id is None or DocumentChunk.knowledge_space_id == space_id),
            or_(
                DocumentChunk.content.ilike(f"%{q}%"),
                DocumentChunk.content.ilike(f"%{q.lower()}%"),
            ),
        )
        .limit(limit)
        .all()
    ):
        source = db.get(Source, chunk.source_id)
        if source:
            results.append(SearchResult(chunk=chunk, source=source, score=1.0))
    results.sort(key=lambda r: r.chunk.content.count(q), reverse=True)
    return results


@router.get("/spaces/{space_id}/search", response_model=list[SearchResult])
async def semantic_search(
    space_id: uuid.UUID,
    q: str = Query(min_length=1, max_length=300),
    limit: int = Query(default=5, le=20),
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SearchResult]:
    _get_space(db, space_id, user)
    try:
        pairs = vector_search(db, user.id, space_id, q, limit)
    except Exception:
        pairs = []
        for chunk in (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.knowledge_space_id == space_id,
                DocumentChunk.user_id == user.id,
                DocumentChunk.content.ilike(f"%{q}%"),
            )
            .limit(limit)
            .all()
        ):
            pairs.append((chunk, 1.0))

    results: list[SearchResult] = []
    for chunk, score in pairs:
        source = db.get(Source, chunk.source_id)
        if source:
            results.append(SearchResult(chunk=chunk, source=source, score=score))
    return results

@router.get("/spaces/{space_id}/graph")
def get_knowledge_graph(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get knowledge graph data (nodes + edges) for visualization."""
    _get_space(db, space_id, user)

    concepts = (
        db.query(Concept)
        .filter(Concept.knowledge_space_id == space_id, Concept.user_id == user.id)
        .all()
    )
    relationships = (
        db.query(Relationship)
        .filter(
            Relationship.knowledge_space_id == space_id,
            Relationship.user_id == user.id,
        )
        .all()
    )

    nodes = [
        {
            "id": str(c.id),
            "label": c.name,
            "type": c.concept_type or "concept",
            "confidence": c.confidence,
            "aliases": c.aliases or [],
            "source_count": len(c.source_ids or []),
        }
        for c in concepts
    ]

    edges = [
        {
            "id": str(r.id),
            "source": str(r.source_concept_id),
            "target": str(r.target_concept_id),
            "type": r.relationship_type or "related_to",
            "weight": r.weight or 1.0,
        }
        for r in relationships
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_concepts": len(nodes),
            "total_relationships": len(edges),
        },
    }


@router.post("/spaces/{space_id}/extract-concepts")
def extract_concepts_from_space(
    space_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Auto-extract concepts from document chunks using keyword extraction."""
    _get_space(db, space_id, user)

    chunks = (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.knowledge_space_id == space_id,
            DocumentChunk.user_id == user.id,
        )
        .all()
    )

    import re
    from collections import Counter

    STOP_WORDS = {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "could",
        "should", "may", "might", "shall", "can", "need", "dare", "ought",
        "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
        "as", "into", "through", "during", "before", "after", "above", "below",
        "between", "out", "off", "over", "under", "again", "further", "then",
        "once", "here", "there", "when", "where", "why", "how", "all", "both",
        "each", "few", "more", "most", "other", "some", "such", "no", "nor",
        "not", "only", "own", "same", "so", "than", "too", "very", "just",
        "don", "now", "this", "that", "these", "those", "and", "but", "or",
        "if", "while", "it", "its", "he", "she", "they", "them", "we", "you",
        "i", "me", "my", "your", "his", "her", "our", "their", "what", "which",
        "who", "whom", "about", "up", "also", "like", "much", "well", "back",
        "even", "still", "new", "good", "one", "two", "first", "last", "long",
        "great", "little", "old", "right", "big", "high", "different", "small",
        "large", "next", "early", "young", "important", "public", "bad", "same",
        "able", "make", "get", "know", "take", "come", "see", "think", "want",
        "give", "use", "find", "tell", "ask", "work", "seem", "feel", "try",
        "leave", "call", "could", "say", "said", "often", "never", "always",
    }

    word_counter = Counter()
    bigram_counter = Counter()

    for chunk in chunks:
        text = re.sub(r"[^a-zA-Z\s]", " ", chunk.content.lower())
        words = [w for w in text.split() if w not in STOP_WORDS and len(w) > 2]
        word_counter.update(words)
        for i in range(len(words) - 1):
            bigram = f"{words[i]} {words[i+1]}"
            bigram_counter.update([bigram])

    existing_names = {
        c.name.lower()
        for c in db.query(Concept).filter(Concept.knowledge_space_id == space_id).all()
    }

    created_concepts = []
    for term, count in bigram_counter.most_common(10):
        if count >= 3 and term not in existing_names:
            concept = Concept(
                user_id=user.id,
                knowledge_space_id=space_id,
                name=term.title(),
                concept_type="auto_extracted",
                confidence=min(count / 10.0, 1.0),
                source_ids=[],
            )
            db.add(concept)
            created_concepts.append({"name": term.title(), "occurrences": count})

    for word, count in word_counter.most_common(15):
        if count >= 5 and word not in existing_names and word.title() not in existing_names:
            concept = Concept(
                user_id=user.id,
                knowledge_space_id=space_id,
                name=word.title(),
                concept_type="auto_extracted",
                confidence=min(count / 15.0, 1.0),
                source_ids=[],
            )
            db.add(concept)
            created_concepts.append({"name": word.title(), "occurrences": count})

    db.commit()

    return {
        "created": len(created_concepts),
        "concepts": created_concepts,
        "chunks_analyzed": len(chunks),
    }
