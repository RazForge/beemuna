"""add project blocks

Revision ID: c3d4e5f6g7h8
Revises: b7f3a1c2d5e9
Create Date: 2026-08-19 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3d4e5f6g7h8"
down_revision: Union[str, None] = "b7f3a1c2d5e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "project_blocks",
        sa.Column("id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=24), nullable=False, server_default="note"),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("content", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_blocks_project_sort", "project_blocks", ["project_id", "sort_order"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_project_blocks_project_sort", table_name="project_blocks")
    op.drop_table("project_blocks")
