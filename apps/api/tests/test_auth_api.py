import uuid

import pytest
from fastapi.testclient import TestClient
from itsdangerous import TimestampSigner
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app

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
def client():
    def override_get_db():
        db = _TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_register_and_me(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@test.dev", "password": "SecurePass123!", "name": "Alice"},
    )
    assert r.status_code == 201
    token = r.json()["access_token"]
    me = client.get("/api/v1/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "alice@test.dev"
    assert me.json()["timezone"] == "Africa/Addis_Ababa"


def test_duplicate_email_rejected(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "alice@test.dev", "password": "SecurePass123!", "name": "Alice2"},
    )
    assert r.status_code == 409


def test_weak_password_rejected(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "bob@test.dev", "password": "short", "name": "Bob"},
    )
    assert r.status_code == 422


def test_login_wrong_password(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "WrongPass123!"},
    )
    assert r.status_code == 401


def test_login_ok_and_logout_revokes(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "SecurePass123!"},
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert client.get("/api/v1/auth/me", headers=auth_headers(token)).status_code == 200
    client.post("/api/v1/auth/logout", headers=auth_headers(token))
    assert client.get("/api/v1/auth/me", headers=auth_headers(token)).status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me", headers=auth_headers("garbage")).status_code == 401


def test_profile_update(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "SecurePass123!"},
    )
    token = r.json()["access_token"]
    r = client.patch(
        "/api/v1/auth/me",
        headers=auth_headers(token),
        json={"calendar_mode": "dual", "numeral_mode": "both", "language": "am"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["calendar_mode"] == "dual"
    assert body["numeral_mode"] == "both"


def test_email_verification(client):
    signer = TimestampSigner(settings.secret_key)
    token = signer.sign("alice@test.dev").decode()
    r = client.post("/api/v1/auth/verify/email", json={"token": token})
    assert r.status_code == 200
    assert r.json()["message"] == "Email verified"
    bad = client.post("/api/v1/auth/verify/email", json={"token": "nonsense"})
    assert bad.status_code == 400


def test_password_change_revokes_sessions(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "SecurePass123!"},
    )
    token = r.json()["access_token"]
    r = client.post(
        "/api/v1/auth/password/change",
        headers=auth_headers(token),
        json={"current_password": "SecurePass123!", "new_password": "NewSecurePass456!"},
    )
    assert r.status_code == 200
    assert client.get("/api/v1/auth/me", headers=auth_headers(token)).status_code == 401
    old = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "SecurePass123!"},
    )
    assert old.status_code == 401
    new = client.post(
        "/api/v1/auth/login",
        json={"email": "alice@test.dev", "password": "NewSecurePass456!"},
    )
    assert new.status_code == 200
