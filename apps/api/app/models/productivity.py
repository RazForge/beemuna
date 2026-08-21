import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TimestampMixin, UUIDMixin
from app.core.database import Base


class Project(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "projects"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    color: Mapped[str | None] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(24), default="active")
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    tasks: Mapped[list["Task"]] = relationship(back_populates="project")


class ProjectBlock(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "project_blocks"
    __table_args__ = (
        Index("ix_project_blocks_project_sort", "project_id", "sort_order"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(24), default="note")
    title: Mapped[str | None] = mapped_column(String(300))
    content: Mapped[dict] = mapped_column(JSONB, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Task(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_user_due", "user_id", "due_at"),
        Index("ix_tasks_user_status", "user_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(12), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="inbox")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    recurrence_rule: Mapped[str | None] = mapped_column(String(128))
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    actual_minutes: Mapped[int | None] = mapped_column(Integer)
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    project: Mapped["Project | None"] = relationship(back_populates="tasks")
    subtasks: Mapped[list["Subtask"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class Subtask(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "subtasks"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="todo")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    task: Mapped["Task"] = relationship(back_populates="subtasks")


class Goal(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "goals"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="active")
    target_date: Mapped[date | None] = mapped_column(Date, index=True)
    start_date: Mapped[date | None] = mapped_column(Date)
    milestone_thresholds: Mapped[list] = mapped_column(JSONB, default=list)

    milestones: Mapped[list["Milestone"]] = relationship(
        back_populates="goal", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship()


class Milestone(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "milestones"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    goal_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("goals.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    achieved: Mapped[bool] = mapped_column(Boolean, default=False)
    achieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    goal: Mapped["Goal"] = relationship(back_populates="milestones")


class JournalEntry(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "journal_entries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text, default="")
    entry_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    mood: Mapped[str | None] = mapped_column(String(24))
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    private: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    entry_type: Mapped[str] = mapped_column(String(24), default="diary")


class Note(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "notes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    folder_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note_folders.id", ondelete="SET NULL"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), index=True
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    knowledge_space_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("knowledge_spaces.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSONB, default=list)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    version: Mapped[int] = mapped_column(Integer, default=1)


class NoteFolder(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "note_folders"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("note_folders.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)


class Habit(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "habits"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("goals.id", ondelete="SET NULL"), index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    frequency: Mapped[str] = mapped_column(String(16), default="daily")
    days_of_week: Mapped[list] = mapped_column(JSONB, default=[0, 1, 2, 3, 4, 5, 6])
    reminder_time: Mapped[str | None] = mapped_column(String(5))
    color: Mapped[str | None] = mapped_column(String(16))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    completions: Mapped[list["HabitCompletion"]] = relationship(
        back_populates="habit", cascade="all, delete-orphan"
    )


class HabitCompletion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "habit_completions"
    __table_args__ = (UniqueConstraint("habit_id", "completed_on"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    habit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), index=True, nullable=False
    )
    completed_on: Mapped[date] = mapped_column(Date, index=True, nullable=False)

    habit: Mapped["Habit"] = relationship(back_populates="completions")


class CalendarEvent(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "calendar_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    goal_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("goals.id", ondelete="SET NULL"))


class FocusSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "focus_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("projects.id", ondelete="SET NULL")
    )
    kind: Mapped[str] = mapped_column(String(16), default="pomodoro")
    status: Mapped[str] = mapped_column(String(16), default="running")
    planned_minutes: Mapped[int] = mapped_column(Integer, default=25)
    remaining_seconds: Mapped[int | None] = mapped_column(Integer)
    elapsed_minutes: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paused_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
