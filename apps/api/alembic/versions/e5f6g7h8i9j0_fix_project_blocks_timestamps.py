"""fix project_blocks created_at/updated_at defaults

Revision ID: e5f6g7h8i9j0
Revises: d4e5f6g7h8i9
Create Date: 2026-08-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e5f6g7h8i9j0"
down_revision: Union[str, None] = "d4e5f6g7h8i9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # created_at/updated_at were created NOT NULL without a server default, so
    # ORM inserts that omit them violate the constraint. Backfill defaults and
    # stamp existing rows so future inserts work and old rows get a value.
    op.execute(
        "ALTER TABLE project_blocks ALTER COLUMN created_at "
        "SET DEFAULT now()"
    )
    op.execute(
        "ALTER TABLE project_blocks ALTER COLUMN updated_at "
        "SET DEFAULT now()"
    )
    op.execute(
        "UPDATE project_blocks SET created_at = now() "
        "WHERE created_at IS NULL"
    )
    op.execute(
        "UPDATE project_blocks SET updated_at = now() "
        "WHERE updated_at IS NULL"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE project_blocks ALTER COLUMN created_at DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE project_blocks ALTER COLUMN updated_at DROP DEFAULT"
    )