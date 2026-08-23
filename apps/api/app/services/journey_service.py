"""Journey system — achievement engine, life score, progress paths."""

import uuid
import logging
from datetime import UTC, datetime, timedelta, date
from collections import Counter

from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import func

from app.models.journey import Achievement, ProgressPath, LifeScore
from app.models.productivity import Task, Goal, Habit, HabitCompletion, FocusSession, Project, Note, JournalEntry
from app.models.knowledge import KnowledgeSpace, Source
from app.models.ai import AIConversation

logger = logging.getLogger(__name__)

# ─── Achievement Definitions ───────────────────────────────────────

ACHIEVEMENT_DEFS = [
    # Productivity
    {"name": "First Step", "desc": "Complete your first task", "icon": "👣", "category": "productivity", "tier": "bronze", "points": 10, "check": lambda s: s["tasks_completed"] >= 1},
    {"name": "Task Warrior", "desc": "Complete 100 tasks", "icon": "⚔️", "category": "productivity", "tier": "silver", "points": 50, "check": lambda s: s["tasks_completed"] >= 100},
    {"name": "Task Master", "desc": "Complete 500 tasks", "icon": "👑", "category": "productivity", "tier": "gold", "points": 100, "check": lambda s: s["tasks_completed"] >= 500},
    {"name": "Project Launcher", "desc": "Create your first project", "icon": "🚀", "category": "productivity", "tier": "bronze", "points": 10, "check": lambda s: s["projects_created"] >= 1},
    {"name": "Goal Setter", "desc": "Set your first goal", "icon": "🎯", "category": "productivity", "tier": "bronze", "points": 10, "check": lambda s: s["goals_created"] >= 1},
    {"name": "Goal Crusher", "desc": "Complete 10 goals", "icon": "💎", "category": "productivity", "tier": "gold", "points": 100, "check": lambda s: s["goals_completed"] >= 10},
    {"name": "Consistent", "desc": "Complete tasks 7 days in a row", "icon": "📅", "category": "productivity", "tier": "silver", "points": 30, "check": lambda s: s["task_streak"] >= 7},
    {"name": "Unbreakable", "desc": "30-day habit streak", "icon": "🔥", "category": "health", "tier": "gold", "points": 80, "check": lambda s: s["max_habit_streak"] >= 30},
    {"name": "Habit Builder", "desc": "7-day habit streak", "icon": "🔗", "category": "health", "tier": "bronze", "points": 20, "check": lambda s: s["max_habit_streak"] >= 7},

    # Focus
    {"name": "Deep Focus", "desc": "Complete 100 focus sessions", "icon": "⚡", "category": "productivity", "tier": "silver", "points": 50, "check": lambda s: s["focus_sessions"] >= 100},
    {"name": "Time Lord", "desc": "Focus for 50 hours total", "icon": "⏰", "category": "productivity", "tier": "gold", "points": 80, "check": lambda s: s["focus_minutes"] >= 3000},
    {"name": "Marathon Focuser", "desc": "Focus for 10 hours in a week", "icon": "🏃", "category": "productivity", "tier": "silver", "points": 40, "check": lambda s: s["weekly_focus_minutes"] >= 600},

    # Knowledge
    {"name": "Knowledge Builder", "desc": "Create 10 notes", "icon": "📝", "category": "knowledge", "tier": "bronze", "points": 20, "check": lambda s: s["notes_created"] >= 10},
    {"name": "Scholar", "desc": "Create 100 notes", "icon": "📚", "category": "knowledge", "tier": "silver", "points": 50, "check": lambda s: s["notes_created"] >= 100},
    {"name": "Wisdom Keeper", "desc": "Create 500 notes", "icon": "🏛️", "category": "knowledge", "tier": "gold", "points": 100, "check": lambda s: s["notes_created"] >= 500},
    {"name": "Researcher", "desc": "Upload 5 documents to knowledge base", "icon": "🔬", "category": "knowledge", "tier": "bronze", "points": 20, "check": lambda s: s["sources_uploaded"] >= 5},
    {"name": "Archivist", "desc": "Upload 50 documents", "icon": "🗂️", "category": "knowledge", "tier": "silver", "points": 50, "check": lambda s: s["sources_uploaded"] >= 50},

    # Reflection
    {"name": "Diary Keeper", "desc": "Write your first journal entry", "icon": "📖", "category": "reflection", "tier": "bronze", "points": 10, "check": lambda s: s["journal_entries"] >= 1},
    {"name": "Reflective Soul", "desc": "Write 30 journal entries", "icon": "🪞", "category": "reflection", "tier": "silver", "points": 40, "check": lambda s: s["journal_entries"] >= 30},
    {"name": "Life Chronicler", "desc": "Write 365 journal entries", "icon": "📜", "category": "reflection", "tier": "gold", "points": 100, "check": lambda s: s["journal_entries"] >= 365},

    # AI
    {"name": "AI Companion", "desc": "Have 10 AI conversations", "icon": "🤖", "category": "intelligence", "tier": "bronze", "points": 15, "check": lambda s: s["ai_conversations"] >= 10},
    {"name": "AI Power User", "desc": "Have 100 AI conversations", "icon": "🧠", "category": "intelligence", "tier": "silver", "points": 50, "check": lambda s: s["ai_conversations"] >= 100},

    # Faith
    {"name": "Faithful", "desc": "Use the app for 30 days", "icon": "🙏", "category": "faith", "tier": "bronze", "points": 20, "check": lambda s: s["days_active"] >= 30},
    {"name": "Devoted", "desc": "Use the app for 365 days", "icon": "✨", "category": "faith", "tier": "gold", "points": 100, "check": lambda s: s["days_active"] >= 365},

    # General milestones
    {"name": "Centurion", "desc": "Earn 500 total points", "icon": "💎", "category": "general", "tier": "silver", "points": 50, "check": lambda s: s["total_points"] >= 500},
    {"name": "Legend", "desc": "Earn 2000 total points", "icon": "🏆", "category": "general", "tier": "gold", "points": 200, "check": lambda s: s["total_points"] >= 2000},
]


def _compute_stats(db: OrmSession, user_id: uuid.UUID) -> dict:
    """Compute user statistics for achievement checking."""
    now = datetime.now(UTC)

    tasks_completed = db.query(func.count(Task.id)).filter(
        Task.user_id == user_id, Task.status == "completed"
    ).scalar() or 0

    projects_created = db.query(func.count(Project.id)).filter(
        Project.user_id == user_id
    ).scalar() or 0

    goals_created = db.query(func.count(Goal.id)).filter(
        Goal.user_id == user_id
    ).scalar() or 0

    goals_completed = db.query(func.count(Goal.id)).filter(
        Goal.user_id == user_id, Goal.status == "completed"
    ).scalar() or 0

    notes_created = db.query(func.count(Note.id)).filter(
        Note.user_id == user_id
    ).scalar() or 0

    journal_entries = db.query(func.count(JournalEntry.id)).filter(
        JournalEntry.user_id == user_id
    ).scalar() or 0

    sources_uploaded = db.query(func.count(Source.id)).filter(
        Source.user_id == user_id
    ).scalar() or 0

    ai_conversations = db.query(func.count(AIConversation.id)).filter(
        AIConversation.user_id == user_id
    ).scalar() or 0

    focus_sessions = db.query(func.count(FocusSession.id)).filter(
        FocusSession.user_id == user_id
    ).scalar() or 0

    focus_minutes = db.query(func.sum(FocusSession.elapsed_minutes)).filter(
        FocusSession.user_id == user_id
    ).scalar() or 0

    # Weekly focus
    week_start = now - timedelta(days=7)
    weekly_focus_minutes = db.query(func.sum(FocusSession.elapsed_minutes)).filter(
        FocusSession.user_id == user_id,
        FocusSession.started_at >= week_start,
    ).scalar() or 0

    # Habit streaks
    habits = db.query(Habit).filter(Habit.user_id == user_id, Habit.active == True).all()
    max_habit_streak = 0
    for h in habits:
        streak = 0
        check_date = date.today()
        while True:
            has = db.query(HabitCompletion.id).filter(
                HabitCompletion.habit_id == h.id,
                HabitCompletion.completed_on == check_date,
            ).first()
            if has:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
        max_habit_streak = max(max_habit_streak, streak)

    # Task streak (consecutive days with completions)
    task_streak = 0
    check_date = date.today()
    while True:
        day_start = datetime.combine(check_date, datetime.min.time()).replace(tzinfo=UTC)
        day_end = datetime.combine(check_date, datetime.max.time()).replace(tzinfo=UTC)
        has = db.query(Task.id).filter(
            Task.user_id == user_id,
            Task.status == "completed",
            Task.completed_at >= day_start,
            Task.completed_at <= day_end,
        ).first()
        if has:
            task_streak += 1
            check_date -= timedelta(days=1)
        else:
            break

    # Days active
    first_task = db.query(func.min(Task.created_at)).filter(Task.user_id == user_id).scalar()
    first_journal = db.query(func.min(JournalEntry.created_at)).filter(JournalEntry.user_id == user_id).scalar()
    earliest = min([d for d in [first_task, first_journal] if d], default=now)
    days_active = (now.date() - earliest.date()).days + 1

    # Total points from existing achievements
    total_points = db.query(func.sum(Achievement.points)).filter(
        Achievement.user_id == user_id
    ).scalar() or 0

    return {
        "tasks_completed": tasks_completed,
        "projects_created": projects_created,
        "goals_created": goals_created,
        "goals_completed": goals_completed,
        "notes_created": notes_created,
        "journal_entries": journal_entries,
        "sources_uploaded": sources_uploaded,
        "ai_conversations": ai_conversations,
        "focus_sessions": focus_sessions,
        "focus_minutes": focus_minutes,
        "weekly_focus_minutes": weekly_focus_minutes,
        "max_habit_streak": max_habit_streak,
        "task_streak": task_streak,
        "days_active": days_active,
        "total_points": total_points,
    }


def check_and_unlock(db: OrmSession, user_id: uuid.UUID) -> list[Achievement]:
    """Check all achievement conditions and unlock any new ones."""
    stats = _compute_stats(db, user_id)
    existing = {
        a.name for a in db.query(Achievement).filter(Achievement.user_id == user_id).all()
    }

    newly_unlocked = []
    now = datetime.now(UTC)

    for defn in ACHIEVEMENT_DEFS:
        if defn["name"] in existing:
            continue
        try:
            if defn["check"](stats):
                achievement = Achievement(
                    user_id=user_id,
                    name=defn["name"],
                    description=defn["desc"],
                    icon=defn["icon"],
                    category=defn["category"],
                    tier=defn["tier"],
                    points=defn["points"],
                    unlocked_at=now,
                    source_type="auto",
                )
                db.add(achievement)
                newly_unlocked.append(achievement)
        except Exception:
            logger.exception(f"Error checking achievement: {defn['name']}")

    if newly_unlocked:
        db.commit()
        for a in newly_unlocked:
            db.refresh(a)

    return newly_unlocked


def compute_life_score(db: OrmSession, user_id: uuid.UUID) -> dict:
    """Compute life scores across all pillars."""
    stats = _compute_stats(db, user_id)
    now = datetime.now(UTC)
    thirty_days_ago = now - timedelta(days=30)

    # Productivity score (0-100)
    recent_tasks = db.query(func.count(Task.id)).filter(
        Task.user_id == user_id,
        Task.status == "completed",
        Task.completed_at >= thirty_days_ago,
    ).scalar() or 0
    productivity = min(recent_tasks * 2, 100)

    # Knowledge score
    total_notes = stats["notes_created"]
    total_sources = stats["sources_uploaded"]
    knowledge = min(total_notes * 2 + total_sources * 5, 100)

    # Health (habits + focus)
    habit_score = min(stats["max_habit_streak"] * 3, 60)
    focus_score = min(stats["focus_minutes"] / 30, 40)
    health = min(habit_score + focus_score, 100)

    # Faith (journaling + consistency)
    journal_score = min(stats["journal_entries"] * 2, 60)
    consistency_score = min(stats["days_active"] * 0.5, 40)
    faith = min(journal_score + consistency_score, 100)

    # Learning (notes + knowledge + AI)
    learning = min(
        stats["notes_created"] * 1.5
        + stats["sources_uploaded"] * 4
        + stats["ai_conversations"] * 1,
        100,
    )

    overall = round((productivity + knowledge + health + faith + learning) / 5, 1)

    score = LifeScore(
        user_id=user_id,
        productivity=productivity,
        knowledge=knowledge,
        health=health,
        faith=faith,
        learning=learning,
        overall=overall,
        breakdown=stats,
        scored_at=now,
    )
    db.add(score)
    db.commit()
    db.refresh(score)

    return {
        "productivity": productivity,
        "knowledge": knowledge,
        "health": health,
        "faith": faith,
        "learning": learning,
        "overall": overall,
        "breakdown": stats,
        "scored_at": now.isoformat(),
    }


# ─── Default Progress Paths ────────────────────────────────────────

DEFAULT_PATHS = [
    {
        "name": "Productivity Journey",
        "slug": "productivity",
        "icon": "⚡",
        "category": "productivity",
        "stages": [
            {"name": "Planner", "desc": "Create your first project", "icon": "📋", "threshold": 1},
            {"name": "Executor", "desc": "Complete 25 tasks", "icon": "✅", "threshold": 25},
            {"name": "Consistent", "desc": "Complete 100 tasks", "icon": "🔥", "threshold": 100},
            {"name": "Focus Expert", "desc": "Complete 50 focus sessions", "icon": "⚡", "threshold": 50},
            {"name": "Life Architect", "desc": "Complete 500 tasks + 200 focus sessions", "icon": "👑", "threshold": 500},
        ],
    },
    {
        "name": "Knowledge Journey",
        "slug": "knowledge",
        "icon": "📚",
        "category": "knowledge",
        "stages": [
            {"name": "Note Taker", "desc": "Create 5 notes", "icon": "📝", "threshold": 5},
            {"name": "Researcher", "desc": "Upload 10 documents", "icon": "🔬", "threshold": 10},
            {"name": "Scholar", "desc": "Create 50 notes", "icon": "📚", "threshold": 50},
            {"name": "Knowledge Architect", "desc": "Upload 50 documents", "icon": "🏛️", "threshold": 50},
            {"name": "Wisdom Builder", "desc": "Create 200 notes + 100 documents", "icon": "💎", "threshold": 200},
        ],
    },
    {
        "name": "Reflection Journey",
        "slug": "reflection",
        "icon": "🪞",
        "category": "reflection",
        "stages": [
            {"name": "Diary Keeper", "desc": "Write 5 journal entries", "icon": "📖", "threshold": 5},
            {"name": "Reflective Soul", "desc": "Write 30 journal entries", "icon": "🪞", "threshold": 30},
            {"name": "Deep Thinker", "desc": "Write 100 journal entries", "icon": "🧠", "threshold": 100},
            {"name": "Life Chronicler", "desc": "Write 365 journal entries", "icon": "📜", "threshold": 365},
            {"name": "Wisdom Sage", "desc": "Write 1000 journal entries", "icon": "✨", "threshold": 1000},
        ],
    },
    {
        "name": "Learning Journey",
        "slug": "learning",
        "icon": "📚",
        "category": "learning",
        "stages": [
            {"name": "Curious Mind", "desc": "Create your first knowledge space", "icon": "🔰", "threshold": 1},
            {"name": "Note Taker", "desc": "Upload 10 documents", "icon": "🔍", "threshold": 10},
            {"name": "Researcher", "desc": "Upload 30 documents + 20 notes", "icon": "🎯", "threshold": 30},
            {"name": "Knowledge Builder", "desc": "Upload 50 documents + 50 notes", "icon": "📖", "threshold": 50},
            {"name": "Scholar", "desc": "Upload 100 documents + 100 notes", "icon": "🏛️", "threshold": 100},
            {"name": "Wisdom Keeper", "desc": "Complete the full journey", "icon": "🏆", "threshold": 200},
        ],
    },
    {
        "name": "Health & Fitness Journey",
        "slug": "health",
        "icon": "💪",
        "category": "health",
        "stages": [
            {"name": "Getting Started", "desc": "Complete 5 habit days", "icon": "🌱", "threshold": 5},
            {"name": "Building Habits", "desc": "Complete 30 habit days", "icon": "🔗", "threshold": 30},
            {"name": "Consistent", "desc": "Complete 100 habit days", "icon": "💪", "threshold": 100},
            {"name": "Unstoppable", "desc": "Complete 300 habit days", "icon": "🔥", "threshold": 300},
            {"name": "Health Master", "desc": "Complete 500 habit days", "icon": "🏆", "threshold": 500},
        ],
    },
    {
        "name": "Financial Growth Journey",
        "slug": "finance",
        "icon": "💰",
        "category": "productivity",
        "stages": [
            {"name": "Budget Beginner", "desc": "Set your first financial goal", "icon": "🌱", "threshold": 1},
            {"name": "Saver", "desc": "Complete 10 tasks toward financial goals", "icon": "💰", "threshold": 10},
            {"name": "Investor", "desc": "Complete 50 financial tasks", "icon": "📈", "threshold": 50},
            {"name": "Wealth Builder", "desc": "Complete 150 financial tasks", "icon": "🏦", "threshold": 150},
            {"name": "Financial Freedom", "desc": "Complete 300 financial tasks", "icon": "👑", "threshold": 300},
        ],
    },
    {
        "name": "Career Development Journey",
        "slug": "career",
        "icon": "🚀",
        "category": "productivity",
        "stages": [
            {"name": "Job Seeker", "desc": "Create your first career project", "icon": "🌱", "threshold": 1},
            {"name": "Networker", "desc": "Complete 20 career tasks", "icon": "🤝", "threshold": 20},
            {"name": "Rising Star", "desc": "Complete 75 career tasks", "icon": "⭐", "threshold": 75},
            {"name": "Leader", "desc": "Complete 200 career tasks", "icon": "🚀", "threshold": 200},
            {"name": "Executive", "desc": "Complete 500 career tasks", "icon": "👑", "threshold": 500},
        ],
    },
    {
        "name": "Creativity Journey",
        "slug": "creativity",
        "icon": "🎨",
        "category": "reflection",
        "stages": [
            {"name": "Spark", "desc": "Write 5 creative notes", "icon": "✨", "threshold": 5},
            {"name": "Artist", "desc": "Write 25 creative notes", "icon": "🎨", "threshold": 25},
            {"name": "Creator", "desc": "Write 75 creative notes", "icon": "🎭", "threshold": 75},
            {"name": "Visionary", "desc": "Write 200 creative notes", "icon": "🌟", "threshold": 200},
            {"name": "Master Creator", "desc": "Write 500 creative notes", "icon": "👑", "threshold": 500},
        ],
    },
    {
        "name": "Social Connections Journey",
        "slug": "social",
        "icon": "🤝",
        "category": "faith",
        "stages": [
            {"name": "Friendly", "desc": "Use the app for 7 days", "icon": "👋", "threshold": 7},
            {"name": "Connected", "desc": "Use the app for 30 days", "icon": "🤝", "threshold": 30},
            {"name": "Community Builder", "desc": "Use the app for 90 days", "icon": "🏘️", "threshold": 90},
            {"name": "Social Pillar", "desc": "Use the app for 180 days", "icon": "🏛️", "threshold": 180},
            {"name": "Beloved", "desc": "Use the app for 365 days", "icon": "❤️", "threshold": 365},
        ],
    },
    {
        "name": "Mindfulness Journey",
        "slug": "mindfulness",
        "icon": "🧘",
        "category": "faith",
        "stages": [
            {"name": "Present", "desc": "Write 3 journal entries + 3 habit days", "icon": "🌱", "threshold": 3},
            {"name": "Calm", "desc": "Write 15 journal entries + 15 habit days", "icon": "🧘", "threshold": 15},
            {"name": "Centered", "desc": "Write 50 journal entries + 50 habit days", "icon": "☮️", "threshold": 50},
            {"name": "Enlightened", "desc": "Write 150 journal entries + 150 habit days", "icon": "🌟", "threshold": 150},
            {"name": "Zen Master", "desc": "Write 365 journal entries + 365 habit days", "icon": "🏆", "threshold": 365},
        ],
    },
    {
        "name": "Spirituality Journey",
        "slug": "spirituality",
        "icon": "🙏",
        "category": "faith",
        "stages": [
            {"name": "Seeker", "desc": "Write 5 prayer or gratitude entries", "icon": "🌱", "threshold": 5},
            {"name": "Faithful", "desc": "Write 30 spiritual journal entries", "icon": "🙏", "threshold": 30},
            {"name": "Devoted", "desc": "Write 100 spiritual entries", "icon": "✨", "threshold": 100},
            {"name": "Enlightened", "desc": "Write 250 spiritual entries", "icon": "🌟", "threshold": 250},
            {"name": "Sage", "desc": "Write 500 spiritual entries", "icon": "🏆", "threshold": 500},
        ],
    },
    {
        "name": "Communication Journey",
        "slug": "communication",
        "icon": "💬",
        "category": "knowledge",
        "stages": [
            {"name": "Talker", "desc": "Have 5 AI conversations", "icon": "💬", "threshold": 5},
            {"name": "Communicator", "desc": "Have 25 AI conversations + 10 notes", "icon": "🗣️", "threshold": 25},
            {"name": "Influencer", "desc": "Have 75 AI conversations + 30 notes", "icon": "📢", "threshold": 75},
            {"name": "Storyteller", "desc": "Have 200 AI conversations + 50 notes", "icon": "📖", "threshold": 200},
            {"name": "Master Communicator", "desc": "Have 500 AI conversations + 100 notes", "icon": "🏆", "threshold": 500},
        ],
    },
    {
        "name": "Leadership Journey",
        "slug": "leadership",
        "icon": "👑",
        "category": "productivity",
        "stages": [
            {"name": "Initiator", "desc": "Create 3 projects + 10 tasks", "icon": "🌱", "threshold": 3},
            {"name": "Organizer", "desc": "Create 10 projects + 50 tasks", "icon": "📋", "threshold": 10},
            {"name": "Director", "desc": "Create 25 projects + 150 tasks", "icon": "🎯", "threshold": 25},
            {"name": "Commander", "desc": "Create 50 projects + 300 tasks", "icon": "⚡", "threshold": 50},
            {"name": "Legendary Leader", "desc": "Create 100 projects + 500 tasks", "icon": "👑", "threshold": 100},
        ],
    },
    {
        "name": "Travel & Culture Journey",
        "slug": "travel",
        "icon": "🌍",
        "category": "learning",
        "stages": [
            {"name": "Explorer", "desc": "Create 3 knowledge notes", "icon": "🗺️", "threshold": 3},
            {"name": "Traveler", "desc": "Create 20 notes + upload 10 documents", "icon": "✈️", "threshold": 20},
            {"name": "Adventurer", "desc": "Create 60 notes + 30 documents", "icon": "🌍", "threshold": 60},
            {"name": "Worldly", "desc": "Create 150 notes + 75 documents", "icon": "🌏", "threshold": 150},
            {"name": "Citizen of the World", "desc": "Create 300 notes + 150 documents", "icon": "🏆", "threshold": 300},
        ],
    },
    {
        "name": "Home & Lifestyle Journey",
        "slug": "home",
        "icon": "🏠",
        "category": "health",
        "stages": [
            {"name": "Settler", "desc": "Complete 5 home-related tasks", "icon": "🌱", "threshold": 5},
            {"name": "Organizer", "desc": "Complete 25 home tasks + 10 habit days", "icon": "🏠", "threshold": 25},
            {"name": "Designer", "desc": "Complete 75 home tasks + 30 habit days", "icon": "🎨", "threshold": 75},
            {"name": "Home Master", "desc": "Complete 200 home tasks + 100 habit days", "icon": "🏡", "threshold": 200},
            {"name": "Lifestyle Expert", "desc": "Complete 400 home tasks + 200 habit days", "icon": "🏆", "threshold": 400},
        ],
    },
    {
        "name": "Technology Journey",
        "slug": "technology",
        "icon": "💻",
        "category": "learning",
        "stages": [
            {"name": "Beginner", "desc": "Create 5 tech notes", "icon": "🌱", "threshold": 5},
            {"name": "Enthusiast", "desc": "Create 25 notes + upload 15 documents", "icon": "💻", "threshold": 25},
            {"name": "Developer", "desc": "Create 75 notes + 40 documents", "icon": "⌨️", "threshold": 75},
            {"name": "Engineer", "desc": "Create 200 notes + 100 documents", "icon": "🔧", "threshold": 200},
            {"name": "Tech Guru", "desc": "Create 500 notes + 250 documents", "icon": "🏆", "threshold": 500},
        ],
    },
]


def init_default_paths(db: OrmSession, user_id: uuid.UUID) -> list[ProgressPath]:
    """Initialize default progress paths for a new user."""
    existing = {p.slug for p in db.query(ProgressPath).filter(ProgressPath.user_id == user_id).all()}
    created = []

    for path_def in DEFAULT_PATHS:
        if path_def["slug"] in existing:
            continue
        path = ProgressPath(
            user_id=user_id,
            name=path_def["name"],
            slug=path_def["slug"],
            icon=path_def["icon"],
            category=path_def["category"],
            stages=path_def["stages"],
            current_stage_index=0,
        )
        db.add(path)
        created.append(path)

    if created:
        db.commit()
        for p in created:
            db.refresh(p)

    return created


def update_progress_paths(db: OrmSession, user_id: uuid.UUID) -> list[ProgressPath]:
    """Update progress path stages based on current stats."""
    stats = _compute_stats(db, user_id)
    paths = db.query(ProgressPath).filter(ProgressPath.user_id == user_id).all()

    metric_map = {
        "productivity": stats["tasks_completed"],
        "knowledge": stats["notes_created"] + stats["sources_uploaded"],
        "reflection": stats["journal_entries"],
        "learning": stats["notes_created"] + stats["sources_uploaded"] + stats["ai_conversations"],
        "health": stats["max_habit_streak"] + stats["focus_sessions"],
        "finance": stats["tasks_completed"],
        "career": stats["tasks_completed"] + stats["projects_created"],
        "creativity": stats["notes_created"],
        "social": stats["days_active"],
        "mindfulness": stats["journal_entries"] + stats["max_habit_streak"],
        "spirituality": stats["journal_entries"],
        "communication": stats["ai_conversations"] + stats["notes_created"],
        "leadership": stats["projects_created"] + stats["tasks_completed"],
        "travel": stats["notes_created"] + stats["sources_uploaded"],
        "home": stats["tasks_completed"] + stats["max_habit_streak"],
        "technology": stats["notes_created"] + stats["sources_uploaded"] + stats["ai_conversations"],
    }

    for path in paths:
        current_metric = metric_map.get(path.slug, 0)
        stages = path.stages or []
        new_index = 0
        for i, stage in enumerate(stages):
            if current_metric >= stage.get("threshold", 0):
                new_index = i

        if new_index != path.current_stage_index:
            path.current_stage_index = new_index
            if new_index == len(stages) - 1 and not path.completed:
                path.completed = True
                path.completed_at = datetime.now(UTC)

    db.commit()
    return paths
