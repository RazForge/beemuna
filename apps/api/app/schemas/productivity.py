import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectIn(BaseModel):
    name: str = Field(max_length=200)
    description: str | None = None
    color: str | None = Field(default=None, max_length=16)
    status: str = Field(default="active", pattern="^(active|completed|archived)$")

class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    color: str | None = Field(default=None, max_length=16)
    status: str | None = Field(default=None, pattern="^(active|completed|archived)$")
    archived: bool | None = None

class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    color: str | None
    status: str
    archived: bool
    created_at: datetime
    updated_at: datetime
    task_count: int = 0
    completed_count: int = 0
    progress: int = 0


class ProjectBlockIn(BaseModel):
    type: str = Field(default="note", pattern="^(note|table|task_list|heading|text|bullets|todo|quote|callout|image|divider|toggle)$")
    title: str | None = Field(default=None, max_length=300)
    content: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0


class ProjectBlockUpdate(BaseModel):
    type: str | None = Field(default=None, pattern="^(note|table|task_list|heading|text|bullets|todo|quote|callout|image|divider|toggle)$")
    title: str | None = Field(default=None, max_length=300)
    content: dict[str, Any] | None = None
    sort_order: int | None = None


class ProjectBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    project_id: uuid.UUID
    type: str = Field(pattern="^(note|table|task_list|heading|text|bullets|todo|quote|callout|image|divider|toggle)$")
    title: str | None
    content: dict[str, Any]
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ── Tasks ─────────────────────────────────────────────────────────────────────

class SubtaskIn(BaseModel):
    title: str = Field(max_length=500)
    sort_order: int = 0

class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, pattern="^(todo|done)$")
    sort_order: int | None = None

class SubtaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    status: str
    sort_order: int
    completed_at: datetime | None
    created_at: datetime

class TaskIn(BaseModel):
    title: str = Field(max_length=500)
    description: str | None = None
    priority: str = Field(default="medium", pattern="^(low|medium|high|urgent)$")
    status: str = Field(default="inbox", pattern="^(inbox|todo|in_progress|done|cancelled)$")
    project_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None
    due_at: datetime | None = None
    start_at: datetime | None = None
    estimated_minutes: int | None = None
    tags: list[str] = []
    sort_order: int = 0
    health_status: str | None = Field(default=None, pattern="^(on_track|at_risk|overdue|stalled|completed)$")
    difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard|expert)$")
    depends_on_task_id: uuid.UUID | None = None
    ai_breakdown: list[Any] | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")
    focus_session_count: int = 0
    total_focus_minutes: int = 0

class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    priority: str | None = Field(default=None, pattern="^(low|medium|high|urgent)$")
    status: str | None = Field(default=None, pattern="^(inbox|todo|in_progress|done|cancelled)$")
    project_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None
    due_at: datetime | None = None
    start_at: datetime | None = None
    estimated_minutes: int | None = None
    actual_minutes: int | None = None
    tags: list[str] | None = None
    sort_order: int | None = None
    completed_at: datetime | None = None
    health_status: str | None = Field(default=None, pattern="^(on_track|at_risk|overdue|stalled|completed)$")
    difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard|expert)$")
    depends_on_task_id: uuid.UUID | None = None
    ai_breakdown: list[Any] | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")
    focus_session_count: int | None = None
    total_focus_minutes: int | None = None

class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    priority: str
    status: str
    project_id: uuid.UUID | None
    goal_id: uuid.UUID | None
    due_at: datetime | None
    start_at: datetime | None
    estimated_minutes: int | None
    actual_minutes: int | None
    tags: list[Any]
    sort_order: int
    completed_at: datetime | None
    subtasks: list[SubtaskOut] = []
    created_at: datetime
    updated_at: datetime
    health_status: str | None
    difficulty: str | None
    depends_on_task_id: uuid.UUID | None
    focus_session_count: int
    total_focus_minutes: int
    ai_breakdown: list[Any] | None
    life_area: str | None


# ── Goals ─────────────────────────────────────────────────────────────────────

class MilestoneIn(BaseModel):
    title: str = Field(max_length=300)
    threshold: int = Field(ge=0, le=100)

class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    threshold: int | None = Field(default=None, ge=0, le=100)
    achieved: bool | None = None

class MilestoneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    threshold: int
    achieved: bool
    achieved_at: datetime | None
    created_at: datetime

class GoalIn(BaseModel):
    title: str = Field(max_length=300)
    description: str | None = None
    status: str = Field(default="active", pattern="^(active|completed|abandoned)$")
    project_id: uuid.UUID | None = None
    target_date: date | None = None
    start_date: date | None = None
    goal_type: str = Field(default="personal", pattern="^(personal|career|learning|health|financial|faith|custom)$")
    progress_percent: int = Field(default=0, ge=0, le=100)
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    risk_status: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    expected_completion: date | None = None
    last_reviewed_at: datetime | None = None
    review_frequency: str = Field(default="weekly", pattern="^(weekly|monthly|quarterly)$")
    ai_summary: str | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")

class GoalUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    status: str | None = Field(default=None, pattern="^(active|completed|abandoned)$")
    project_id: uuid.UUID | None = None
    target_date: date | None = None
    start_date: date | None = None
    goal_type: str | None = Field(default=None, pattern="^(personal|career|learning|health|financial|faith|custom)$")
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    risk_status: str | None = Field(default=None, pattern="^(low|medium|high|critical)$")
    expected_completion: date | None = None
    last_reviewed_at: datetime | None = None
    review_frequency: str | None = Field(default=None, pattern="^(weekly|monthly|quarterly)$")
    ai_summary: str | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")

class GoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    status: str
    project_id: uuid.UUID | None
    target_date: date | None
    start_date: date | None
    milestones: list[MilestoneOut] = []
    created_at: datetime
    updated_at: datetime
    goal_type: str
    progress_percent: int
    confidence_score: float | None
    risk_status: str | None
    expected_completion: date | None
    last_reviewed_at: datetime | None
    review_frequency: str
    ai_summary: str | None
    life_area: str | None


# ── Journal ───────────────────────────────────────────────────────────────────

class JournalEntryIn(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    content: str = ""
    entry_date: date
    mood: str | None = Field(default=None, max_length=24)
    tags: list[str] = []
    favorite: bool = False
    private: bool = True
    project_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None
    entry_type: str = Field(default="diary", pattern="^(diary|todo|gratitude|idea|prayer|other)$")

class JournalEntryUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    content: str | None = None
    mood: str | None = Field(default=None, max_length=24)
    tags: list[str] | None = None
    favorite: bool | None = None
    private: bool | None = None
    entry_type: str | None = Field(default=None, pattern="^(diary|todo|gratitude|idea|prayer|other)$")

class JournalEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str | None
    content: str
    entry_date: date
    mood: str | None
    tags: list[Any]
    favorite: bool
    private: bool
    project_id: uuid.UUID | None
    goal_id: uuid.UUID | None
    entry_type: str = "diary"
    version: int
    created_at: datetime
    updated_at: datetime


# ── Notes ─────────────────────────────────────────────────────────────────────

class NoteFolderIn(BaseModel):
    name: str = Field(max_length=200)
    parent_id: uuid.UUID | None = None

class NoteFolderUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    parent_id: uuid.UUID | None = None

class NoteFolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    parent_id: uuid.UUID | None
    created_at: datetime

class NoteIn(BaseModel):
    title: str = Field(max_length=300)
    content: str = ""
    folder_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None
    tags: list[str] = []
    favorite: bool = False

class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    content: str | None = None
    folder_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None
    tags: list[str] | None = None
    favorite: bool | None = None
    archived: bool | None = None

class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    content: str
    folder_id: uuid.UUID | None
    project_id: uuid.UUID | None
    task_id: uuid.UUID | None
    goal_id: uuid.UUID | None
    tags: list[Any]
    favorite: bool
    archived: bool
    version: int
    created_at: datetime
    updated_at: datetime


# ── Habits ────────────────────────────────────────────────────────────────────

class HabitIn(BaseModel):
    name: str = Field(max_length=200)
    description: str | None = None
    frequency: str = Field(default="daily", pattern="^(daily|weekly)$")
    days_of_week: list[int] = [0, 1, 2, 3, 4, 5, 6]
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    color: str | None = Field(default=None, max_length=16)
    goal_id: uuid.UUID | None = None
    stage: str = Field(default="new", pattern="^(new|building|established|strong|automatic|mastered)$")
    strength_score: float | None = Field(default=None, ge=0, le=100)
    identity_label: str | None = Field(default=None, max_length=200)
    chain_id: uuid.UUID | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")

class HabitUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = None
    frequency: str | None = Field(default=None, pattern="^(daily|weekly)$")
    days_of_week: list[int] | None = None
    reminder_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    color: str | None = Field(default=None, max_length=16)
    active: bool | None = None
    goal_id: uuid.UUID | None = None
    stage: str | None = Field(default=None, pattern="^(new|building|established|strong|automatic|mastered)$")
    strength_score: float | None = Field(default=None, ge=0, le=100)
    identity_label: str | None = Field(default=None, max_length=200)
    chain_id: uuid.UUID | None = None
    life_area: str | None = Field(default=None, pattern="^(career|learning|health|faith|relationships|finance|personal_growth)$")

class HabitCompletionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    habit_id: uuid.UUID
    completed_on: date
    created_at: datetime

class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    description: str | None
    frequency: str
    days_of_week: list[Any]
    reminder_time: str | None
    color: str | None
    active: bool
    goal_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    stage: str
    strength_score: float | None
    current_streak: int
    longest_streak: int
    identity_label: str | None
    chain_id: uuid.UUID | None
    life_area: str | None


# ── Calendar Events ───────────────────────────────────────────────────────────

class CalendarEventIn(BaseModel):
    title: str = Field(max_length=300)
    description: str | None = None
    starts_at: datetime
    ends_at: datetime | None = None
    all_day: bool = False
    task_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None

class CalendarEventUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool | None = None
    task_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    goal_id: uuid.UUID | None = None

class CalendarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime | None
    all_day: bool
    task_id: uuid.UUID | None
    project_id: uuid.UUID | None
    goal_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


# ── Focus Sessions ────────────────────────────────────────────────────────────

class FocusSessionIn(BaseModel):
    kind: str = Field(default="pomodoro", pattern="^(pomodoro|custom)$")
    planned_minutes: int = Field(default=25, ge=1, le=480)
    task_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None

class FocusSessionUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(running|paused|completed|cancelled)$")
    remaining_seconds: int | None = None
    elapsed_minutes: int | None = None

class FocusSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: str
    status: str
    planned_minutes: int
    remaining_seconds: int | None
    elapsed_minutes: int
    task_id: uuid.UUID | None
    project_id: uuid.UUID | None
    started_at: datetime
    ended_at: datetime | None
    paused_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ── Productivity Engine 2.0: New Schemas ─────────────────────────────────────

class TaskBreakdownIn(BaseModel):
    context: str | None = None

class TaskBreakdownOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    task_id: uuid.UUID
    subtasks: list[str]

class DependencyIn(BaseModel):
    depends_on_task_id: uuid.UUID

class HealthUpdateIn(BaseModel):
    health_status: str = Field(pattern="^(on_track|at_risk|overdue|stalled|completed)$")

class FocusRecordIn(BaseModel):
    minutes: int = Field(gt=0, le=480)


class GoalConfidenceUpdateIn(BaseModel):
    confidence_score: float = Field(ge=0, le=1)


class GoalReviewIn(BaseModel):
    notes: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)

class GoalReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    goal_id: uuid.UUID
    user_id: uuid.UUID
    reviewed_at: datetime
    notes: str | None
    rating: int | None
    created_at: datetime


class ProgressUpdateIn(BaseModel):
    progress_percent: int = Field(ge=0, le=100)


class HabitStageUpdateIn(BaseModel):
    stage: str = Field(pattern="^(new|building|established|strong|automatic|mastered)$")


class HabitRecoveryIn(BaseModel):
    days_back: int = Field(default=7, ge=1, le=30)


class HabitChainIn(BaseModel):
    name: str = Field(max_length=200)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=16)
    bonus_multiplier: float = Field(default=1.0, ge=0.5, le=5.0)
    habit_ids: list[uuid.UUID] = []

class HabitChainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    icon: str | None
    bonus_multiplier: float
    habits: list[HabitOut] = []
    created_at: datetime
    updated_at: datetime


class HabitAnalyticsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_habits: int
    active_habits: int
    completion_rate: float
    current_streaks: dict[str, int]
    longest_streaks: dict[str, int]
    by_stage: dict[str, int]
    by_life_area: dict[str, int]
    heatmap: dict[str, int]
    chain_bonus_active: bool


class WeeklyReviewIn(BaseModel):
    week_start: date
    tasks_completed: int = 0
    goals_advanced: int = 0
    habit_completion_pct: float | None = None
    focus_hours: float | None = None
    achievements_earned: int = 0
    momentum_score: float | None = None
    ai_summary: str | None = None
    blockers: str | None = None
    wins: str | None = None
    lessons: str | None = None

class WeeklyReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    user_id: uuid.UUID
    week_start: date
    week_end: date
    tasks_completed: int
    goals_advanced: int
    habit_completion_pct: float | None
    focus_hours: float | None
    achievements_earned: int
    momentum_score: float | None
    ai_summary: str | None
    blockers: str | None
    wins: str | None
    lessons: str | None
    created_at: datetime
    updated_at: datetime


class MomentumOut(BaseModel):
    score: float
    trend: str
    components: dict[str, float]
