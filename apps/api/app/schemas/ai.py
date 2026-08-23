import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ConversationIn(BaseModel):
    mode: str = Field(default="assistant", pattern="^(assistant|research|journal|planner)$")
    title: str | None = Field(default=None, max_length=300)
    knowledge_space_id: uuid.UUID | None = None

class ConversationUpdate(BaseModel):
    mode: str | None = Field(default=None, pattern="^(assistant|research|journal|planner)$")
    title: str | None = Field(default=None, max_length=300)
    knowledge_space_id: uuid.UUID | None = None

class ConversationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    mode: str
    title: str | None
    knowledge_space_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    conversation_id: uuid.UUID
    role: str
    content: str
    status: str
    sources: list[Any]
    created_at: datetime

class ConversationDetailOut(ConversationOut):
    messages: list[MessageOut]

class ChatIn(BaseModel):
    content: str = Field(min_length=1, max_length=20000)

class ChatOut(BaseModel):
    user_message: MessageOut
    assistant_message: MessageOut

class ProviderStatusOut(BaseModel):
    active_provider: str
    model: str = ""
    primary_model: str | None = None
    reasoning_model: str | None = None
    fallback_model: str | None = None
    multimodal_model: str | None = None
    ollama_configured: bool = False
    ollama_available: bool = False
    openai_configured: bool = False
    anthropic_configured: bool = False
    gemini_configured: bool = False
    nvidia_configured: bool = False
    local_ollama_available: bool = False
    local_models: list[str] = Field(default_factory=list)
    fallback_chain: str | None = None
    debug_env_gemini_set: bool | None = None


class AISettingsOut(BaseModel):
    ai_perspective: str = "neutral"
    ai_local_enabled: bool = False
    ai_local_model: str | None = None
    ai_cloud_model: str | None = None
    ai_memory_enabled: bool = True
    ai_journal_context: bool = False
    ai_save_new_memories: bool = True


class AISettingsUpdate(BaseModel):
    ai_perspective: str | None = Field(default=None, pattern="^(christian|muslim|jewish|hindu|buddhist|secular|neutral)$")
    ai_local_enabled: bool | None = None
    ai_local_model: str | None = Field(default=None, max_length=64)
    ai_cloud_model: str | None = Field(default=None, max_length=64)
    ai_memory_enabled: bool | None = None
    ai_journal_context: bool | None = None
    ai_save_new_memories: bool | None = None


class MemoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    content: str
    category: str
    source: str
    importance: float
    tags: list
    created_at: datetime
    updated_at: datetime


class MemoryIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    category: str = Field(default="fact", pattern="^(preference|fact|goal|context)$")
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=2000)
    category: str | None = Field(default=None, pattern="^(preference|fact|goal|context)$")
    importance: float | None = Field(default=None, ge=0.0, le=1.0)