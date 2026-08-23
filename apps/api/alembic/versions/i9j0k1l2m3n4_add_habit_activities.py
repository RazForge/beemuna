"""add habit activities

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "i9j0k1l2m3n4"
down_revision = "6967de255b48"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE habits ADD COLUMN activities JSONB DEFAULT '[]' NOT NULL;
        EXCEPTION WHEN duplicate_column THEN
        END $$;
    """)


def downgrade() -> None:
    op.drop_column("habits", "activities")
