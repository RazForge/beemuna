"""add_productivity_engine_2_0

Add advanced productivity features:
- Task: health_status, difficulty, depends_on, focus stats, ai_breakdown, life_area
- Goal: goal_type, progress_percent, confidence_score, risk_status, expected_completion, review fields, life_area
- Habit: stage, strength_score, streaks, identity_label, chain_id, life_area
- New tables: habit_chains, weekly_reviews
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = "d1e2f3g4h5i6"
down_revision = "cbb598ab9a55"
branch_labels: Sequence[str] | str | None = None
depends_on: Sequence[str] | str | None = None


def upgrade() -> None:
    # ── Tasks new columns ──────────────────────────────────────────────
    op.add_column("tasks", sa.Column("health_status", sa.String(24), nullable=True, index=True))
    op.add_column("tasks", sa.Column("difficulty", sa.String(16), nullable=True))
    op.add_column("tasks", sa.Column("depends_on_task_id", sa.UUID(), nullable=True, index=True))
    op.add_column("tasks", sa.Column("focus_session_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("total_focus_minutes", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("ai_breakdown", JSONB(), nullable=True))
    op.add_column("tasks", sa.Column("life_area", sa.String(32), nullable=True, index=True))

    op.create_foreign_key(
        "fk_tasks_depends_on_task_id",
        "tasks", "tasks",
        ["depends_on_task_id"], ["id"],
        ondelete="SET NULL",
    )

    # ── Goals new columns ──────────────────────────────────────────────
    op.add_column("goals", sa.Column("goal_type", sa.String(24), nullable=False, server_default="personal", index=True))
    op.add_column("goals", sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("goals", sa.Column("confidence_score", sa.Float(), nullable=True))
    op.add_column("goals", sa.Column("risk_status", sa.String(24), nullable=True))
    op.add_column("goals", sa.Column("expected_completion", sa.Date(), nullable=True))
    op.add_column("goals", sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("goals", sa.Column("review_frequency", sa.String(16), nullable=True, server_default="weekly"))
    op.add_column("goals", sa.Column("ai_summary", sa.Text(), nullable=True))
    op.add_column("goals", sa.Column("life_area", sa.String(32), nullable=True, index=True))

    # ── Habits new columns ─────────────────────────────────────────────
    op.add_column("habits", sa.Column("stage", sa.String(24), nullable=True, server_default="new", index=True))
    op.add_column("habits", sa.Column("strength_score", sa.Float(), nullable=True))
    op.add_column("habits", sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("habits", sa.Column("longest_streak", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("habits", sa.Column("identity_label", sa.String(200), nullable=True))
    op.add_column("habits", sa.Column("chain_id", sa.UUID(), nullable=True, index=True))
    op.add_column("habits", sa.Column("life_area", sa.String(32), nullable=True, index=True))

    # ── New tables ────────────────────────────────────────────────────
    op.create_table(
        "habit_chains",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(16), nullable=True),
        sa.Column("bonus_multiplier", sa.Float(), nullable=False, server_default="1.0"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_habit_chains_user_id", "habit_chains", ["user_id"])

    op.create_table(
        "weekly_reviews",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("week_end", sa.Date(), nullable=False),
        sa.Column("tasks_completed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("goals_advanced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("habit_completion_pct", sa.Float(), nullable=True),
        sa.Column("focus_hours", sa.Float(), nullable=True),
        sa.Column("achievements_earned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("momentum_score", sa.Float(), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("blockers", sa.Text(), nullable=True),
        sa.Column("wins", sa.Text(), nullable=True),
        sa.Column("lessons", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_weekly_reviews_user_id", "weekly_reviews", ["user_id"])
    op.create_index("ix_weekly_reviews_week_start", "weekly_reviews", ["week_start"])


def downgrade() -> None:
    op.drop_index("ix_weekly_reviews_week_start", table_name="weekly_reviews")
    op.drop_index("ix_weekly_reviews_user_id", table_name="weekly_reviews")
    op.drop_table("weekly_reviews")
    op.drop_index("ix_habit_chains_user_id", table_name="habit_chains")
    op.drop_table("habit_chains")

    op.drop_column("habits", "life_area")
    op.drop_column("habits", "chain_id")
    op.drop_column("habits", "identity_label")
    op.drop_column("habits", "longest_streak")
    op.drop_column("habits", "current_streak")
    op.drop_column("habits", "strength_score")
    op.drop_column("habits", "stage")

    op.drop_column("goals", "life_area")
    op.drop_column("goals", "ai_summary")
    op.drop_column("goals", "review_frequency")
    op.drop_column("goals", "last_reviewed_at")
    op.drop_column("goals", "expected_completion")
    op.drop_column("goals", "risk_status")
    op.drop_column("goals", "confidence_score")
    op.drop_column("goals", "progress_percent")
    op.drop_column("goals", "goal_type")

    op.drop_constraint("fk_tasks_depends_on_task_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "life_area")
    op.drop_column("tasks", "ai_breakdown")
    op.drop_column("tasks", "total_focus_minutes")
    op.drop_column("tasks", "focus_session_count")
    op.drop_column("tasks", "depends_on_task_id")
    op.drop_column("tasks", "difficulty")
    op.drop_column("tasks", "health_status")
