"""add religion to users

Revision ID: b7f3a1c2d5e9
Revises: a72153789b62
Create Date: 2026-08-19 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b7f3a1c2d5e9"
down_revision: Union[str, None] = "a72153789b62"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("religion", sa.String(length=16), nullable=False, server_default="christian"))


def downgrade() -> None:
    op.drop_column("users", "religion")