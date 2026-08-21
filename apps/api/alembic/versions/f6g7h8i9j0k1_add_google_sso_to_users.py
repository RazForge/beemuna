"""add google sso to users

Revision ID: f6g7h8i9j0k1
Revises: e5f6g7h8i9j0
Create Date: 2026-08-20 13:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6g7h8i9j0k1"
down_revision: Union[str, None] = "e5f6g7h8i9j0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("google_sub", sa.String(length=255), nullable=True))
    op.create_index("ix_users_google_sub", "users", ["google_sub"], unique=True)
    op.add_column(
        "users",
        sa.Column("auth_provider", sa.String(length=16),
                  nullable=False, server_default="password"),
    )

    # email stays unique, but as a partial unique index so multiple rows with
    # NULL email (Google-only users) don't collide.
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.execute(
        "CREATE UNIQUE INDEX ix_users_email ON users (email) WHERE email IS NOT NULL"
    )
    op.execute("UPDATE users SET email = NULL WHERE email = ''")
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=True)
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    # Fold duplicate emails (keep earliest), backfill empties, restore strict NOT NULL.
    op.execute(
        """
        UPDATE users u SET email = dup.email FROM (
            SELECT DISTINCT ON (email) id, email FROM users
            WHERE email IS NOT NULL ORDER BY email, created_at
        ) dup
        WHERE u.id != dup.id AND u.email IS NOT DISTINCT FROM dup.email
        """
    )
    op.alter_column("users", "email", existing_type=sa.String(length=320), nullable=False)
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)
    op.execute("DROP INDEX IF EXISTS ix_users_email")
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.drop_column("users", "auth_provider")
    op.drop_index("ix_users_google_sub", table_name="users")
    op.drop_column("users", "google_sub")