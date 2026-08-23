import shutil
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models.knowledge import Source
from app.models.reminders import Notification
from app.models.user import Session as SessionModel
from app.models.user import User


def cleanup_sessions(db: OrmSession) -> int:
    now = datetime.now(UTC)
    expired = (
        db.query(SessionModel)
        .filter(
            SessionModel.expires_at < now,
            SessionModel.revoked_at.is_(None),
        )
        .update({"revoked_at": now}, synchronize_session=False)
    )
    return int(expired)


def purge_deleted_users(db: OrmSession, older_than_days: int = 30) -> int:
    cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
    users = (
        db.query(User)
        .filter(User.deleted_at.isnot(None), User.deleted_at < cutoff)
        .all()
    )
    for user in users:
        db.delete(user)
    return len(users)


def purge_read_notifications(db: OrmSession, older_than_days: int = 90) -> int:
    cutoff = datetime.now(UTC) - timedelta(days=older_than_days)
    deleted = (
        db.query(Notification)
        .filter(Notification.read_at.isnot(None), Notification.read_at < cutoff)
        .delete(synchronize_session=False)
    )
    return int(deleted)


def purge_orphan_files(db: OrmSession) -> int:
    base = Path(settings.upload_dir)
    if not base.exists():
        return 0
    removed = 0
    for user_dir in base.iterdir():
        if not user_dir.is_dir():
            continue
        for space_dir in user_dir.iterdir():
            if not space_dir.is_dir():
                continue
            for file_path in space_dir.iterdir():
                if not file_path.is_file():
                    continue
                source_id = _source_id_from_filename(file_path.name)
                if source_id and not db.get(Source, source_id):
                    try:
                        file_path.unlink()
                        removed += 1
                    except OSError:
                        pass
    return removed


def _source_id_from_filename(filename: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(filename.rsplit(".", 1)[0])
    except (ValueError, IndexError):
        return None


def run_cleanup(db: OrmSession) -> dict[str, int]:
    result = {
        "sessions_revoked": cleanup_sessions(db),
        "users_purged": purge_deleted_users(db),
        "notifications_purged": purge_read_notifications(db),
    }
    db.commit()
    return result
