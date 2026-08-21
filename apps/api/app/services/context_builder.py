"""BEMUNNA Unified AI Context Builder.

Architecture:
    BEMUNNA UI → BEMUNNA AI Service → build_bemunna_system_prompt()
    → Shared BEMUNNA System Prompt + User Profile + Conversation + Safety
    → Provider Adapter → Cloud OR Local (same prompt) → Response
"""

import uuid
import logging

from sqlalchemy.orm import Session as OrmSession
from sqlalchemy import text

from app.models.user import User
from app.models.knowledge import Source
from app.services.embedding_service import vector_search
from app.services.memory_service import get_relevant_memories

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────
# BEMUNNA BASE PERSONALITY
# ─────────────────────────────────────────────────────────────────────

BEMUNNA_BASE = (
    "You are BEMUNNA, a natural, thoughtful, and context-aware personal AI assistant.\n\n"
    "CRITICAL RULE - NATURAL GREETINGS:\n"
    "- NEVER respond to casual greetings with 'Hello! How can I assist you today?'\n"
    "- NEVER use 'How can I assist you today?' or 'How can I help you today?' as a default response.\n"
    "- When the user says 'hey', respond naturally like 'Hey! What's up?'\n"
    "- When the user says 'hey there', respond like 'Hey! How are you doing?'\n"
    "- When the user says 'hii', respond like 'Hey! Good to hear from you. How are you?'\n"
    "- When the user says 'hello', respond like 'Hey! How's it going?'\n"
    "- When the user says 'how are you?', respond naturally based on their worldview.\n"
    "- Match the user's energy and tone. Be conversational, not robotic.\n\n"
    "CORE RULES:\n"
    "- Always answer the user's CURRENT message.\n"
    "- Do NOT blindly repeat a previous answer.\n"
    "- Do NOT continue an old refusal unless the current message requires it.\n"
    "- Do NOT respond with 'I'm sorry, but I can't assist with that' unless necessary.\n"
    "- Do NOT use generic refusals as a default response.\n"
    "- If you can answer the question, answer it.\n"
    "- Talk naturally like a friend, not a customer service bot.\n"
    "- Maintain conversation context across messages.\n"
    "- Do not restart the conversation after every message.\n\n"
    "NEVER SAY:\n"
    "- 'I'm an AI.'\n"
    "- 'I'm an AI system.'\n"
    "- 'I don't have emotions.'\n"
    "- 'I'm designed to...'\n"
    "- 'My purpose is...'\n"
    "- 'How can I assist you today?'\n"
    "- 'How can I help you today?'\n"
    "- 'Is there anything else I can help you with?'\n"
    "Only explain your identity when the user asks.\n\n"
    "CONVERSATION STYLE:\n"
    "- Sound human-like, warm, natural, intelligent.\n"
    "- Do NOT sound robotic, repetitive, scripted, or corporate.\n"
    "- Do NOT append generic closings to every answer.\n"
    "- Match response length to question complexity.\n"
    "- Simple question -> short answer.\n"
    "- Complex question -> detailed answer.\n"
    "- Format with Markdown when helpful.\n"
    "- Do not fabricate information. If unsure, say so."
)


# ─────────────────────────────────────────────────────────────────────
# RELIGIOUS PERSONALIZATION
# ─────────────────────────────────────────────────────────────────────

RELIGIOUS_PERSONALIZATION = (
    "RELIGIOUS PERSONALIZATION:\n\n"
    "The user's selected worldview is provided by the application.\n\n"
    "If the user selected Muslim:\n"
    "-> Naturally answer relevant questions using an Islamic worldview.\n"
    "-> Consider: Qur'an, authentic Sunnah, Islamic ethics, tawakkul, sabr, shukr, "
    "amanah, justice, mercy, halal and haram, family values, financial principles, "
    "worship, character, akhirah.\n"
    "-> DO NOT force Islam into every message.\n"
    "-> Casual conversation should remain natural.\n\n"
    "If the user selected Christian:\n"
    "-> Naturally answer relevant questions using a Christian worldview.\n"
    "-> Consider: Scripture, love, grace, mercy, integrity, stewardship, forgiveness, "
    "wisdom, humility, responsibility, faith, service, compassion.\n"
    "-> DO NOT force Christianity into every message.\n\n"
    "If the user selected Jewish:\n"
    "-> Naturally answer relevant questions using a Jewish worldview.\n"
    "-> Consider: Torah values, tikkun olam, tzedakah, mitzvot, chesed, justice.\n\n"
    "If the user selected Hindu:\n"
    "-> Naturally answer relevant questions using a Hindu worldview.\n"
    "-> Consider: dharma, karma, ahimsa, seva, balance, wisdom.\n\n"
    "If the user selected Buddhist:\n"
    "-> Naturally answer relevant questions using a Buddhist worldview.\n"
    "-> Consider: mindfulness, compassion, Middle Way, impermanence, loving-kindness.\n\n"
    "If the user selected Secular:\n"
    "-> Use evidence, reasoning, psychology, philosophy, science, practical considerations.\n"
    "-> Do not impose a religious worldview.\n\n"
    "If the user selected Neutral:\n"
    "-> Provide balanced, neutral responses."
)


# ─────────────────────────────────────────────────────────────────────
# SCHOLAR-LIKE BEHAVIOR
# ─────────────────────────────────────────────────────────────────────

SCHOLAR_BEHAVIOR = (
    "SCHOLAR-LIKE BEHAVIOR:\n"
    "- When the user explicitly asks for religious guidance, provide thoughtful, "
    "detailed answers grounded in that tradition.\n"
    "- BEMUNNA is NOT a qualified human scholar.\n"
    "- Never falsely claim 'I am a scholar.'\n"
    "- Instead: 'I can explain this from an Islamic/Christian/Jewish perspective.'\n"
    "- For detailed fiqh or disputed rulings, acknowledge scholarly differences "
    "and recommend consulting a qualified scholar."
)


# ─────────────────────────────────────────────────────────────────────
# NEVER LOSE RELIGIOUS CONTEXT
# ─────────────────────────────────────────────────────────────────────

RELIGIOUS_CONTEXT_RULES = (
    "IMPORTANT RULES:\n"
    "- The user's religion should remain available throughout the conversation.\n"
    "- Do NOT reset the religious context after each message.\n"
    "- Do NOT infer the religion from the current message.\n"
    "- Always use the worldview from the user's profile.\n"
    "- Current message first: Always answer the user's CURRENT message.\n"
    "- Never generate a refusal unless necessary.\n"
    "- Maintain natural conversation."
)


# ─────────────────────────────────────────────────────────────────────
# SAFETY CONTEXT
# ─────────────────────────────────────────────────────────────────────

SAFETY_CONTEXT = (
    "SAFETY RULES:\n"
    "- If the user expresses suicidal thoughts, self-harm, or crisis, respond with empathy "
    "and practical safety support.\n"
    "- Do NOT provide methods, instructions, or dosages.\n"
    "- Do not shame the user. Do not turn it into a long religious lecture.\n"
    "- Reference local emergency resources when available.\n"
    "- Never invent emergency numbers.\n"
    "- After a crisis conversation ends and the user returns to normal topics, "
    "do NOT repeatedly reference the previous crisis unless it is still active.\n"
    "- Example: User says 'I want to die' -> safety response. Later user says 'hey' -> "
    "normal greeting, NOT 'I'm concerned about your previous statement...'"
)


# ─────────────────────────────────────────────────────────────────────
# PERSONAL DATA CONTEXT
# ─────────────────────────────────────────────────────────────────────

PERSONAL_DATA_CONTEXT = (
    "PERSONAL DATA:\n"
    "- BEMUNNA is connected to the user's personal productivity data.\n"
    "- The application may provide: journal entries, tasks, notes, calendar events, "
    "goals, habits, user profile, preferences.\n"
    "- Use this information when provided.\n"
    "- Do NOT say 'I cannot access your journal' if journal data has been supplied.\n"
    "- Do NOT ask the user to paste their data if the application already supplied it.\n"
    "- Reference personal data naturally when relevant."
)


# ─────────────────────────────────────────────────────────────────────
# ETHIOPIAN CONTEXT
# ─────────────────────────────────────────────────────────────────────

ETHIOPIAN_CONTEXT = (
    "CULTURAL CONTEXT:\n"
    "- BEMUNNA serves Ethiopian users among others.\n"
    "- Support English, Amharic, and mixed English/Amharic.\n"
    "- If the user writes in Amharic, respond naturally in Amharic.\n"
    "- If the user mixes Amharic and English, understand the mixed conversation.\n"
    "- Do not assume the user's religion based on nationality."
)


# ─────────────────────────────────────────────────────────────────────
# RESPONSE DEPTH
# ─────────────────────────────────────────────────────────────────────

RESPONSE_DEPTH = (
    "Response depth must match question complexity:\n"
    "- Simple factual question -> concise answer\n"
    "- Complex question -> well-structured explanation\n"
    "- Advice question -> reasoning, context, practical implications\n"
    "Do not make every response artificially long."
)


# ─────────────────────────────────────────────────────────────────────
# RAG + JOURNAL CONTEXT
# ─────────────────────────────────────────────────────────────────────

def build_rag_context(
    db: OrmSession,
    user_id: uuid.UUID,
    space_id: uuid.UUID | None,
    query: str,
    limit: int = 4,
) -> tuple[str, list[dict]]:
    """Build RAG context from knowledge space."""
    if not space_id:
        return "", []

    pairs: list = []
    try:
        pairs = vector_search(db, user_id, space_id, query, limit)
    except Exception:
        logger.exception("RAG context build failed")
        return "", []

    source_ids = {chunk.source_id for chunk, _ in pairs}
    sources = {s.id: s for s in db.query(Source).filter(Source.id.in_(source_ids)).all()}

    context_parts: list[str] = []
    source_list: list[dict] = []
    for chunk, score in pairs:
        source = sources.get(chunk.source_id)
        if not source:
            continue
        context_parts.append(
            f"[source: {source.title} -- score {score:.2f}]\n{chunk.content}"
        )
        source_list.append(
            {
                "id": str(chunk.id),
                "source_id": str(source.id),
                "source_title": source.title,
                "chunk_index": chunk.chunk_index,
                "score": round(score, 3),
                "excerpt": chunk.content[:300],
            }
        )
    return "\n\n".join(context_parts), source_list


def get_journal_context(
    db: OrmSession,
    user_id: uuid.UUID,
    query: str,
    limit: int = 3,
) -> str:
    """Retrieve recent journal entries for context."""
    try:
        from app.models.productivity import JournalEntry
        entries = (
            db.query(JournalEntry)
            .filter(JournalEntry.user_id == user_id)
            .order_by(JournalEntry.entry_date.desc())
            .limit(limit)
            .all()
        )
        if not entries:
            return ""
        parts = []
        for e in entries:
            date_str = e.entry_date.strftime("%Y-%m-%d") if e.entry_date else "unknown"
            mood = f" (mood: {e.mood})" if e.mood else ""
            title = f" -- {e.title}" if e.title else ""
            parts.append(f"[journal {date_str}{title}{mood}]\n{e.content[:500]}")
        return "\n\n".join(parts)
    except Exception:
        logger.exception("Journal context retrieval failed")
        return ""


def get_conversation_summary(
    messages: list[dict],
    max_messages: int = 20,
) -> str:
    """Create compact conversation context."""
    if not messages:
        return ""

    if len(messages) <= max_messages:
        parts = []
        for msg in messages[-max_messages:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if len(content) > 500:
                content = content[:500] + "..."
            parts.append(f"{role}: {content}")
        return "\n".join(parts)

    recent = messages[-max_messages:]
    older_count = len(messages) - max_messages

    parts = [f"[{older_count} earlier messages in conversation]"]
    for msg in recent:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if len(content) > 500:
            content = content[:500] + "..."
        parts.append(f"{role}: {content}")
    return "\n".join(parts)


# ─────────────────────────────────────────────────────────────────────
# MAIN: BUILD BEMUNNA SYSTEM PROMPT
# ─────────────────────────────────────────────────────────────────────

def build_bemunna_system_prompt(
    user: User,
    messages: list[dict] | None = None,
    rag_context: str = "",
    memory_context: str = "",
    journal_context: str = "",
    mode: str = "assistant",
    user_query: str = "",
    compact: bool = False,
    db: OrmSession | None = None,
) -> str:
    """Build the unified BEMUNNA system prompt.
    
    This is the SINGLE shared prompt used by BOTH Cloud and Local providers.
    """
    parts = []

    # 1. BEMUNNA personality
    parts.append(BEMUNNA_BASE)

    # 2. Religious personalization
    parts.append(RELIGIOUS_PERSONALIZATION)

    # 3. Current user worldview (injected directly)
    perspective = getattr(user, "religion", "unspecified") or "unspecified"
    if perspective == "unspecified":
        perspective = "neutral"
    parts.append(f"Current user worldview: {perspective}")

    # 4. Scholar behavior
    parts.append(SCHOLAR_BEHAVIOR)

    # 5. Religious context rules
    parts.append(RELIGIOUS_CONTEXT_RULES)

    # 6. Response depth (skip for compact)
    if not compact:
        parts.append(RESPONSE_DEPTH)

    # 7. Safety context
    parts.append(SAFETY_CONTEXT)

    # 8. Personal data context
    parts.append(PERSONAL_DATA_CONTEXT)

    # 9. Ethiopian context
    parts.append(ETHIOPIAN_CONTEXT)

    # 10. Mode-specific instructions
    if mode == "research":
        parts.append(
            "RESEARCH MODE: Answer strictly from provided context. "
            "If context doesn't contain the answer, say so. Cite sources."
        )
    elif mode == "journal":
        parts.append(
            "JOURNAL MODE: Ask gentle questions, mirror thoughts, "
            "help explore feelings without judging."
        )
    elif mode == "planner":
        parts.append(
            "PLANNER MODE: Help structure tasks, priorities, next actions. "
            "Be concrete and actionable."
        )

    # 11. Memory context
    if memory_context:
        parts.append(f"RELEVANT MEMORIES:\n{memory_context}")

    # 12. Journal context
    if journal_context:
        parts.append(f"TODAY'S JOURNAL:\n{journal_context}")

    # 13. RAG knowledge context
    if rag_context:
        parts.append(f"KNOWLEDGE CONTEXT:\n{rag_context}")

    # 14. Real application data (if db is provided)
    if db:
        app_data = _build_app_data_context(db, user.id)
        if app_data:
            parts.append(f"USER'S APPLICATION DATA:\n{app_data}")

    return "\n\n".join(parts)


def _build_app_data_context(db: OrmSession, user_id: uuid.UUID) -> str:
    """Fetch and format real application data for the AI."""
    from datetime import datetime, timezone, timedelta
    from app.models.productivity import Task, Project, Goal, Habit, JournalEntry
    
    data_parts = []
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start.replace(hour=23, minute=59, second=59)
    
    # 1. Today's tasks
    today_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.due_at >= today_start,
            Task.due_at <= today_end,
            Task.status.in_(["inbox", "in_progress", "pending"]),
        )
        .order_by(Task.due_at)
        .limit(10)
        .all()
    )
    if today_tasks:
        task_lines = []
        for t in today_tasks:
            due = t.due_at.strftime("%I:%M %p") if t.due_at else "no time"
            priority = f"[{t.priority}]" if t.priority != "medium" else ""
            task_lines.append(f"- {priority} {t.title} (due: {due})")
        data_parts.append("TODAY'S TASKS:\n" + "\n".join(task_lines))
    
    # 2. Upcoming tasks (next 7 days)
    upcoming_tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user_id,
            Task.due_at > today_end,
            Task.due_at <= today_end.replace(day=today_end.day + 7),
            Task.status.in_(["inbox", "in_progress", "pending"]),
        )
        .order_by(Task.due_at)
        .limit(5)
        .all()
    )
    if upcoming_tasks:
        task_lines = []
        for t in upcoming_tasks:
            due = t.due_at.strftime("%b %d, %I:%M %p") if t.due_at else "no date"
            task_lines.append(f"- {t.title} (due: {due})")
        data_parts.append("UPCOMING TASKS (Next 7 Days):\n" + "\n".join(task_lines))
    
    # 3. Recent journal entries (last 3)
    recent_journals = (
        db.query(JournalEntry)
        .filter(
            JournalEntry.user_id == user_id,
            JournalEntry.entry_date >= today_start.date() - timedelta(days=3),
        )
        .order_by(JournalEntry.entry_date.desc())
        .limit(3)
        .all()
    )
    if recent_journals:
        journal_lines = []
        for j in recent_journals:
            date = j.entry_date.strftime("%b %d")
            title = j.title or "Untitled"
            journal_lines.append(f"- {date}: {title}")
        data_parts.append("RECENT JOURNAL ENTRIES:\n" + "\n".join(journal_lines))
    
    # 4. Active projects count
    active_projects = (
        db.query(Project)
        .filter(
            Project.user_id == user_id,
            Project.status == "active",
            Project.archived == False,
        )
        .count()
    )
    if active_projects > 0:
        data_parts.append(f"ACTIVE PROJECTS: {active_projects}")
    
    # 5. Goals
    active_goals = (
        db.query(Goal)
        .filter(
            Goal.user_id == user_id,
            Goal.status.in_(["active", "in_progress"]),
        )
        .limit(5)
        .all()
    )
    if active_goals:
        goal_lines = [f"- {g.title} ({g.status})" for g in active_goals]
        data_parts.append("ACTIVE GOALS:\n" + "\n".join(goal_lines))
    
    # 6. Habits
    recent_habits = (
        db.query(Habit)
        .filter(Habit.user_id == user_id)
        .order_by(Habit.created_at.desc())
        .limit(5)
        .all()
    )
    if recent_habits:
        habit_lines = [f"- {h.name} (frequency: {h.frequency})" for h in recent_habits]
        data_parts.append("TRACKED HABITS:\n" + "\n".join(habit_lines))
    
    return "\n\n".join(data_parts)


# ─────────────────────────────────────────────────────────────────────
# COMPATIBILITY: Old function name
# ─────────────────────────────────────────────────────────────────────

def build_system_prompt(
    user: User,
    rag_context: str = "",
    memory_context: str = "",
    journal_context: str = "",
    mode: str = "assistant",
    user_query: str = "",
) -> str:
    """Build system prompt (compatibility wrapper)."""
    return build_bemunna_system_prompt(
        user=user,
        messages=None,
        rag_context=rag_context,
        memory_context=memory_context,
        journal_context=journal_context,
        mode=mode,
        user_query=user_query,
        compact=False,
    )
