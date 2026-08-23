import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session as OrmSession

from app.models.audit import AuditLog


def audit(
    db: OrmSession,
    action: str,
    *,
    user_id: uuid.UUID | None = None,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    ip: str | None = None,
    user_agent: str | None = None,
    meta: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            ip=ip,
            user_agent=(user_agent or "")[:512] or None,
            meta=meta or {},
            created_at=datetime.now(UTC),
        )
    )
