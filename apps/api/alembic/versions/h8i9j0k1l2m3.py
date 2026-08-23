"""add ai_memories and ai fields to users

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-08-21
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_memories table
    op.create_table(
        "ai_memories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", sa.String(32), server_default="fact", nullable=False),
        sa.Column("source", sa.String(32), server_default="user", nullable=False),
        sa.Column("importance", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("tags", postgresql.JSONB(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Add AI preference columns to users
    op.add_column("users", sa.Column("ai_perspective", sa.String(24), server_default="neutral", nullable=False))
    op.add_column("users", sa.Column("ai_local_enabled", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("ai_local_model", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("ai_cloud_model", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("ai_memory_enabled", sa.Boolean(), server_default="true", nullable=False))
    op.add_column("users", sa.Column("ai_journal_context", sa.Boolean(), server_default="false", nullable=False))
    op.add_column("users", sa.Column("ai_save_new_memories", sa.Boolean(), server_default="true", nullable=False))


def downgrade() -> None:
    op.drop_table("ai_memories")
    op.drop_column("users", "ai_perspective")
    op.drop_column("users", "ai_local_enabled")
    op.drop_column("users", "ai_local_model")
    op.drop_column("users", "ai_cloud_model")
    op.drop_column("users", "ai_memory_enabled")
    op.drop_column("users", "ai_journal_context")
    op.drop_column("users", "ai_save_new_memories")
