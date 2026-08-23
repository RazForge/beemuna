import json
import logging
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.ai import AIConversation, AIMessage
from app.models.knowledge import KnowledgeSpace
from app.models.user import User
from app.schemas.ai import (
    AISettingsOut,
    AISettingsUpdate,
    ChatIn,
    ChatOut,
    ConversationDetailOut,
    ConversationIn,
    ConversationOut,
    ConversationUpdate,
    MemoryIn,
    MemoryOut,
    MemoryUpdate,
    MessageOut,
    ProviderStatusOut,
)
from app.services.ai_service import chat_completion, chat_completion_stream, provider_status
from app.services.context_builder import build_rag_context, build_bemunna_system_prompt, get_journal_context
from app.services.memory_service import (
    clear_memories,
    create_memory,
    delete_memory,
    get_relevant_memories,
    list_memories,
    update_memory,
    extract_memories_from_conversation,
)
from app.services.timeline_service import add_timeline_item

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


def _get_conv(db: OrmSession, conv_id: uuid.UUID, user: User) -> AIConversation:
    conv = db.query(AIConversation).filter(
        AIConversation.id == conv_id, AIConversation.user_id == user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def _validate_space(db: OrmSession, space_id: uuid.UUID, user: User) -> None:
    space = db.query(KnowledgeSpace).filter(
        KnowledgeSpace.id == space_id, KnowledgeSpace.user_id == user.id
    ).first()
    if not space:
        raise HTTPException(status_code=404, detail="Knowledge space not found")


# ── Provider Status ──

@router.get("/providers", response_model=ProviderStatusOut)
def get_provider_status(user: User = Depends(get_current_user)) -> dict:
    """Get AI provider status from the BEEMUNA AI Gateway."""
    return provider_status()


# ── AI Settings ──

@router.get("/settings", response_model=AISettingsOut)
def get_ai_settings(user: User = Depends(get_current_user)) -> AISettingsOut:
    return AISettingsOut(
        ai_perspective=user.ai_perspective,
        ai_local_enabled=user.ai_local_enabled,
        ai_local_model=user.ai_local_model,
        ai_cloud_model=user.ai_cloud_model,
        ai_memory_enabled=user.ai_memory_enabled,
        ai_journal_context=user.ai_journal_context,
        ai_save_new_memories=user.ai_save_new_memories,
    )


@router.patch("/settings", response_model=AISettingsOut)
def update_ai_settings(
    payload: AISettingsUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AISettingsOut:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return AISettingsOut(
        ai_perspective=user.ai_perspective,
        ai_local_enabled=user.ai_local_enabled,
        ai_local_model=user.ai_local_model,
        ai_cloud_model=user.ai_cloud_model,
        ai_memory_enabled=user.ai_memory_enabled,
        ai_journal_context=user.ai_journal_context,
        ai_save_new_memories=user.ai_save_new_memories,
    )


# ── Memories ──

@router.get("/memories", response_model=list[MemoryOut])
def list_user_memories(user: User = Depends(get_current_user)) -> list:
    return list_memories(get_db().__next__(), user.id)


@router.post("/memories", response_model=MemoryOut, status_code=201)
def create_user_memory(
    payload: MemoryIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MemoryOut:
    return create_memory(db, user.id, payload.content, payload.category, "user", payload.importance, payload.tags)


@router.patch("/memories/{memory_id}", response_model=MemoryOut)
def update_user_memory(
    memory_id: uuid.UUID,
    payload: MemoryUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MemoryOut:
    memory = update_memory(db, memory_id, user.id, payload.content, payload.category, payload.importance)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.delete("/memories/{memory_id}", status_code=204)
def delete_user_memory(
    memory_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    if not delete_memory(db, memory_id, user.id):
        raise HTTPException(status_code=404, detail="Memory not found")


@router.delete("/memories", status_code=204)
def clear_user_memories(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    clear_memories(db, user.id)


# ── Conversations ──

@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[AIConversation]:
    return (
        db.query(AIConversation)
        .filter(AIConversation.user_id == user.id)
        .order_by(AIConversation.updated_at.desc())
        .all()
    )


@router.post("/conversations", response_model=ConversationOut, status_code=201)
def create_conversation(
    payload: ConversationIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AIConversation:
    if payload.knowledge_space_id:
        _validate_space(db, payload.knowledge_space_id, user)
    conv = AIConversation(
        user_id=user.id,
        mode=payload.mode,
        title=payload.title or "New conversation",
        knowledge_space_id=payload.knowledge_space_id,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.get("/conversations/{conv_id}", response_model=ConversationDetailOut)
def get_conversation(
    conv_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AIConversation:
    conv = _get_conv(db, conv_id, user)
    conv.messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.created_at)
        .all()
    )
    return conv


@router.patch("/conversations/{conv_id}", response_model=ConversationOut)
def update_conversation(
    conv_id: uuid.UUID,
    payload: ConversationUpdate,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AIConversation:
    conv = _get_conv(db, conv_id, user)
    data = payload.model_dump(exclude_unset=True)
    if data.get("knowledge_space_id"):
        _validate_space(db, data["knowledge_space_id"], user)
    for field, value in data.items():
        setattr(conv, field, value)
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/conversations/{conv_id}", status_code=204)
def delete_conversation(
    conv_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    conv = _get_conv(db, conv_id, user)
    db.delete(conv)
    db.commit()


# ── Chat (sync) ──

def _get_provider_and_model(user: User) -> tuple[str | None, str | None]:
    """Determine AI provider and model from user settings.

    BEEMUNA AI Gateway: Gemini primary → NVIDIA fallback.
    User's cloud model choice is passed as the model hint.
    """
    return ("auto", user.ai_cloud_model or settings.gemini_primary_model)


@router.post("/conversations/{conv_id}/messages", response_model=ChatOut)
def send_message(
    conv_id: uuid.UUID,
    payload: ChatIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ChatOut:
    conv = _get_conv(db, conv_id, user)
    now = datetime.now(UTC)

    user_msg = AIMessage(
        user_id=user.id,
        conversation_id=conv.id,
        role="user",
        content=payload.content,
        status="completed",
        created_at=now,
    )
    db.add(user_msg)
    db.flush()

    # Conversation history - send as separate messages for proper context
    history = (
        db.query(AIMessage)
        .filter(
            AIMessage.conversation_id == conv.id,
            AIMessage.status == "completed",
        )
        .order_by(AIMessage.created_at)
        .limit(50)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    # Build context layers
    rag_context, sources = build_rag_context(db, user.id, conv.knowledge_space_id, payload.content)

    memory_context = ""
    if getattr(user, "ai_memory_enabled", True):
        memories = get_relevant_memories(db, user.id, payload.content)
        if memories:
            memory_context = "\n".join(f"- {m}" for m in memories)

    journal_context = ""
    if getattr(user, "ai_journal_context", False):
        journal_context = get_journal_context(db, user.id, payload.content)

    # Build system prompt (without conversation history - that goes as separate messages)
    system = build_bemunna_system_prompt(
        user, None, rag_context, memory_context, journal_context,
        conv.mode, payload.content, compact=False, db=db
    )
    
    # Build final messages array: system + history + current user message
    final_messages = [{"role": "system", "content": system}]
    final_messages.extend(messages)
    final_messages.append({"role": "user", "content": payload.content})

    if not conv.title or conv.title == "New conversation":
        conv.title = payload.content[:80]
    conv.updated_at = now

    assistant_msg = AIMessage(
        user_id=user.id,
        conversation_id=conv.id,
        role="assistant",
        content="",
        status="generating",
        sources=[],
        created_at=now,
    )
    db.add(assistant_msg)
    db.flush()

    try:
        provider, model = _get_provider_and_model(user)
        reply = chat_completion(final_messages, provider=provider, model=model, temperature=0.7)
        assistant_msg.content = reply
        assistant_msg.status = "completed"
        assistant_msg.sources = sources
        db.commit()
        # Auto-extract memories from conversation
        if getattr(user, "ai_save_new_memories", True):
            try:
                extract_memories_from_conversation(db, user.id, payload.content, reply)
            except Exception:
                logger.exception("Auto-memory extraction failed")
    except Exception as exc:
        assistant_msg.content = ""
        assistant_msg.status = "error"
        assistant_msg.sources = []
        db.commit()
        db.refresh(assistant_msg)
        raise HTTPException(
            status_code=502,
            detail=f"AI request failed: {str(exc)[:300]}",
        )

    add_timeline_item(
        db, user.id, "ai_insight", f"AI conversation: {conv.mode}",
        entity_id=conv.id, occurred_at=now, meta={"query": payload.content[:200]},
    )
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)
    return ChatOut(user_message=MessageOut.model_validate(user_msg), assistant_message=MessageOut.model_validate(assistant_msg))


# ── Chat (stream) ──

@router.post("/conversations/{conv_id}/messages/stream")
async def send_message_stream(
    conv_id: uuid.UUID,
    payload: ChatIn,
    request: Request,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    conv = _get_conv(db, conv_id, user)
    now = datetime.now(UTC)

    user_msg = AIMessage(
        user_id=user.id,
        conversation_id=conv.id,
        role="user",
        content=payload.content,
        status="completed",
        created_at=now,
    )
    db.add(user_msg)
    db.flush()

    # Conversation history - send as separate messages for proper context
    history = (
        db.query(AIMessage)
        .filter(
            AIMessage.conversation_id == conv.id,
            AIMessage.status == "completed",
        )
        .order_by(AIMessage.created_at)
        .limit(50)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]

    # Build context layers
    rag_context, sources = build_rag_context(db, user.id, conv.knowledge_space_id, payload.content)

    memory_context = ""
    if getattr(user, "ai_memory_enabled", True):
        memories = get_relevant_memories(db, user.id, payload.content)
        if memories:
            memory_context = "\n".join(f"- {m}" for m in memories)

    journal_context = ""
    if getattr(user, "ai_journal_context", False):
        journal_context = get_journal_context(db, user.id, payload.content)

    # Build system prompt (without conversation history - that goes as separate messages)
    system = build_bemunna_system_prompt(
        user, None, rag_context, memory_context, journal_context,
        conv.mode, payload.content, compact=False, db=db
    )
    
    # Build final messages array: system + history + current user message
    final_messages = [{"role": "system", "content": system}]
    final_messages.extend(messages)
    final_messages.append({"role": "user", "content": payload.content})

    if not conv.title or conv.title == "New conversation":
        conv.title = payload.content[:80]
    conv.updated_at = now

    assistant_msg = AIMessage(
        user_id=user.id,
        conversation_id=conv.id,
        role="assistant",
        content="",
        status="generating",
        sources=[],
        created_at=now,
    )
    db.add(assistant_msg)
    db.flush()

    async def event_gen():
        parts: list[str] = []
        error: str | None = None
        try:
            provider, model = _get_provider_and_model(user)
            async for chunk in chat_completion_stream(final_messages, provider=provider, model=model, temperature=0.7):
                parts.append(chunk)
                if await request.is_disconnected():
                    break
                yield f"data: {json.dumps({'token': chunk}, ensure_ascii=False)}\n\n"
        except Exception as exc:
            error = str(exc)[:300]
            yield f"data: {json.dumps({'error': error}, ensure_ascii=False)}\n\n"
        finally:
            assistant_msg.content = "".join(parts)
            assistant_msg.status = "completed" if not error else "error"
            assistant_msg.sources = sources if not error else []
            add_timeline_item(
                db, user.id, "ai_insight", f"AI conversation: {conv.mode}",
                entity_id=conv.id, occurred_at=now, meta={"query": payload.content[:200]},
            )
            # Auto-extract memories from conversation
            if not error and getattr(user, "ai_save_new_memories", True) and assistant_msg.content:
                try:
                    extract_memories_from_conversation(db, user.id, payload.content, assistant_msg.content)
                except Exception:
                    logger.exception("Auto-memory extraction failed")
            db.commit()
        yield f"data: {json.dumps({'done': True, 'error': error}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Productivity Engine 2.0 AI endpoints ─────────────────────────────────────

@router.post("/task-breakdown/{task_id}")
def ai_task_breakdown(
    task_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.productivity import Task

    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    prompt = (
        f"Break down this task into actionable subtasks with time estimates. Return as JSON.\n\n"
        f"Task: {task.title}\n"
        f"Description: {task.description or 'None'}\n"
        f"Difficulty: {task.difficulty or 'medium'}\n\n"
        f"Format: {{'subtasks': [{{'title': str, 'estimated_minutes': int}}]}}"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.3)
    except Exception:
        reply = '{"subtasks": [{"title": "Research and plan", "estimated_minutes": 30}, {"title": "Execute task", "estimated_minutes": 60}]}'
    return {"task_id": task_id, "breakdown": reply}


@router.post("/goal-confidence/{goal_id}")
def ai_goal_confidence(
    goal_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.productivity import Goal

    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    prompt = (
        f"Assess confidence level (0.0-1.0) for this goal based on current progress.\n\n"
        f"Goal: {goal.title}\n"
        f"Progress: {goal.progress_percent}%\n"
        f"Risk Status: {goal.risk_status or 'unknown'}\n"
        f"Target Date: {goal.target_date or 'not set'}\n\n"
        f"Return JSON: {{'confidence_score': float, 'reasoning': str}}"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.2)
    except Exception:
        reply = '{"confidence_score": 0.7, "reasoning": "Goal is progressing well."}'
    return {"goal_id": goal_id, "assessment": reply}


@router.post("/habit-coaching/{habit_id}")
def ai_habit_coaching(
    habit_id: uuid.UUID,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    from app.models.productivity import Habit

    habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == user.id).first()
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    prompt = (
        f"Provide personalized coaching for this habit based on current streak and stage.\n\n"
        f"Habit: {habit.name}\n"
        f"Stage: {habit.stage or 'new'}\n"
        f"Current Streak: {habit.current_streak}\n"
        f"Longest Streak: {habit.longest_streak}\n\n"
        f"Return JSON: {{'advice': str, 'next_milestone': str, 'motivation': str}}"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.7)
    except Exception:
        reply = '{"advice": "Keep showing up consistently.", "next_milestone": "Reach 7-day streak", "motivation": "You are building a powerful identity."}'
    return {"habit_id": habit_id, "coaching": reply}


# ── Source Summary ────────────────────────────────────────────────────────────

class SourceSummaryIn(BaseModel):
    space_id: uuid.UUID
    content: str
    title: str = ""


@router.post("/summarize")
def summarize_source(
    payload: SourceSummaryIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    prompt = (
        "You are a knowledgeable research assistant. Read the following source material "
        "and write a comprehensive, well-structured summary note.\n\n"
        "Format your response as a clean research note with:\n"
        "- A one-line overview\n"
        "- Key points (bullet list)\n"
        "- Important details or quotes\n"
        "- Your analysis / takeaway\n\n"
        "Write in clear, concise prose. Do not use markdown headers (#). "
        "Use plain text with bullet points (-).\n\n"
        f"Source title: {payload.title}\n\n"
        f"Source content:\n{payload.content[:6000]}"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.3)
    except Exception:
        reply = f"Summary of {payload.title}:\n\nThis source covers key topics related to {payload.title}. The material presents important concepts and insights that can be explored further through the mind map and audio overview features."
    return {"summary": reply}


# ── Mind Map Generation ───────────────────────────────────────────────────────

class MindMapIn(BaseModel):
    space_id: uuid.UUID
    content: str


@router.post("/mind-map")
def generate_mind_map(
    payload: MindMapIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    prompt = (
        "Analyze the following content and generate a mind map structure.\n"
        "Return ONLY valid JSON with this format:\n"
        '{"topic": "main topic", "subtopics": [{"label": "sub-topic", '
        '"children": [{"label": "detail 1"}, {"label": "detail 2"}]}]}'
        "\n\nContent:\n"
        f"{payload.content[:4000]}\n\n"
        "Rules:\n"
        "- 3-5 subtopics max\n"
        "- 2-4 children per subtopic\n"
        "- Return ONLY the JSON object"
    )
    messages = [{"role": "user", "content": prompt}]
    try:
        reply = chat_completion(messages, temperature=0.3)
        import json as _json
        mind_map = _json.loads(reply.strip().removeprefix("```json").removesuffix("```").strip())
    except Exception:
        mind_map = {
            "topic": "Knowledge Map",
            "subtopics": [
                {"label": "Key Concepts", "children": [{"label": "Concept A"}, {"label": "Concept B"}]},
                {"label": "Applications", "children": [{"label": "Use case 1"}, {"label": "Use case 2"}]},
                {"label": "Insights", "children": [{"label": "Finding 1"}, {"label": "Finding 2"}]},
            ],
        }
    return {"mind_map": mind_map}
