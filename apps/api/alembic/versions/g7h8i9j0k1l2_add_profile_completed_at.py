"""add profile completed + city to users

Revision ID: g7h8i9j0k1l2
Revises: f6g7h8i9j0k1
Create Date: 2026-08-20 14:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, None] = "f6g7h8i9j0k1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(length=120), nullable=True))
    # Backfill existing users so only NEW sign-ups are gated.
    op.execute("UPDATE users SET profile_completed_at = now()")


def downgrade() -> None:
    op.drop_column("users", "city")
    op.drop_column("users", "profile_completed_at")