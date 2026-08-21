import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.knowledge import DocumentChunk, Embedding, KnowledgeSpace, Source
from app.models.user import User
from app.services.embedding_service import embed_chunks

TEST_DB_URL = settings.database_url.rsplit("/", 1)[0] + "/beemuna_test"
_PG_URL = settings.database_url.replace("postgresql+psycopg://", "postgresql://")
_admin_url = _PG_URL.rsplit("/", 1)[0] + "/postgres"


def _ensure_test_db() -> None:
    import psycopg

    with psycopg.connect(_admin_url, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", ("beemuna_test",)
        ).fetchone()
        if not exists:
            conn.execute("CREATE DATABASE beemuna_test")
    with psycopg.connect(_PG_URL.rsplit("/", 1)[0] + "/beemuna_test", autocommit=True) as conn:
        conn.execute("CREATE EXTENSION IF NOT EXISTS vector")


_engine = create_engine(TEST_DB_URL, poolclass=StaticPool)
_TestingSessionLocal = sessionmaker(bind=_engine, autocommit=False, autoflush=False)


@pytest.fixture(scope="module", autouse=True)
def test_db():
    _ensure_test_db()
    Base.metadata.drop_all(bind=_engine)
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def db():
    session = _TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    def override_get_db():
        db = _TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _setup(db):
    user = User(email="emb@test.dev", password_hash="fake", name="Emb")
    db.add(user)
    db.flush()
    space = KnowledgeSpace(user_id=user.id, name="Test Space")
    db.add(space)
    db.flush()
    source = Source(
        user_id=user.id,
        knowledge_space_id=space.id,
        type="upload",
        title="Test Doc",
        storage_path="test.pdf",
        status="ready",
    )
    db.add(source)
    db.flush()
    chunk1 = DocumentChunk(
        user_id=user.id,
        knowledge_space_id=space.id,
        source_id=source.id,
        chunk_index=0,
        content="Hello world",
    )
    chunk2 = DocumentChunk(
        user_id=user.id,
        knowledge_space_id=space.id,
        source_id=source.id,
        chunk_index=1,
        content="Goodbye world",
    )
    db.add_all([chunk1, chunk2])
    db.commit()
    return user.id, space.id, source.id, [chunk1.id, chunk2.id]


@patch("app.services.embedding_service.embed_text", return_value=[0.1] * 768)
def test_embed_chunks_dedup(mock_embed, db):
    user_id, space_id, source_id, _ = _setup(db)

    count1 = embed_chunks(db, user_id, space_id, source_id)
    assert count1 == 2
    embeddings_after_first = db.query(Embedding).filter(Embedding.knowledge_space_id == space_id).count()
    assert embeddings_after_first == 2

    count2 = embed_chunks(db, user_id, space_id, source_id)
    assert count2 == 2
    embeddings_after_second = db.query(Embedding).filter(Embedding.knowledge_space_id == space_id).count()
    assert embeddings_after_second == 2
