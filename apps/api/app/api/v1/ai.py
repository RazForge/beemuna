import json
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
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
)
from app.services.timeline_service import add_timeline_item

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
    """Get AI provider status - Cloud AI only."""
    from app.core.config import settings
    
    # Check NVIDIA cloud API
    nvidia_configured = bool(settings.nvidia_api_key)
    
    return {
        "active_provider": "nvidia",
        "model": user.ai_cloud_model or "meta/llama-3.1-8b-instruct",
        "ollama_configured": False,
        "ollama_available": False,
        "openai_configured": False,
        "anthropic_configured": False,
        "gemini_configured": False,
        "nvidia_configured": nvidia_configured,
        "local_ollama_available": False,
        "local_models": [],
    }


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
    
    BEMUNNA now uses Cloud AI only (NVIDIA).
    """
    if user.ai_cloud_model:
        return ("nvidia", user.ai_cloud_model)
    # Default to NVIDIA cloud
    return ("nvidia", "meta/llama-3.1-8b-instruct")


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
            db.commit()
        yield f"data: {json.dumps({'done': True, 'error': error}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
