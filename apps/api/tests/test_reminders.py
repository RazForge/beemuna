from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.reminders import Reminder
from app.models.user import User
from workers.reminders import _is_quiet_hours, process_due_reminders

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


class FakeUser:
    def __init__(self, user_id, timezone="UTC", quiet_hours_start="22:00", quiet_hours_end="07:00"):
        self.id = user_id
        self.timezone = timezone
        self.quiet_hours_start = quiet_hours_start
        self.quiet_hours_end = quiet_hours_end


class FakeUserModel:
    def __init__(self, user_id, timezone="UTC"):
        self.id = user_id
        self.timezone = timezone
        self.quiet_hours_start = "22:00"
        self.quiet_hours_end = "07:00"


def test_is_quiet_hours_ethiopia_vs_utc():
    addis_tz = "Africa/Addis_Ababa"
    utc_tz = "UTC"

    now = datetime(2024, 1, 1, 23, 0, tzinfo=UTC)

    user_addis = FakeUser("user-1", timezone=addis_tz, quiet_hours_start="22:00", quiet_hours_end="07:00")
    user_utc = FakeUser("user-2", timezone=utc_tz, quiet_hours_start="22:00", quiet_hours_end="07:00")

    assert _is_quiet_hours(user_addis, now) is True

    assert _is_quiet_hours(user_utc, now) is True


def test_is_quiet_hours_not_in_quiet_hours():
    utc_tz = "UTC"
    now = datetime(2024, 1, 1, 10, 0, tzinfo=UTC)
    user = FakeUser("user-1", timezone=utc_tz, quiet_hours_start="22:00", quiet_hours_end="07:00")
    assert _is_quiet_hours(user, now) is False


def test_recurring_reminder_creates_only_one_next(db):
    user = User(
        email="rem@test.dev",
        password_hash="fake",
        name="Rem",
        timezone="UTC",
    )
    db.add(user)
    db.flush()

    reminder = Reminder(
        user_id=user.id,
        type="task",
        title="Standup",
        scheduled_at=datetime.now(UTC) - timedelta(minutes=1),
        recurrence_rule="every 60",
        status="scheduled",
    )
    db.add(reminder)
    db.commit()

    now = datetime.now(UTC)
    processed = process_due_reminders(db, now)

    assert len(processed) == 1
    assert processed[0].status == "sent"

    remaining = db.query(Reminder).filter(Reminder.user_id == user.id).count()
    assert remaining == 2

    scheduled = db.query(Reminder).filter(Reminder.user_id == user.id, Reminder.status == "scheduled").first()
    assert scheduled is not None
    assert scheduled.scheduled_at > now
