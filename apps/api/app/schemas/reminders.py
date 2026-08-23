import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


# ── Reminders ─────────────────────────────────────────────────────────────────

class ReminderIn(BaseModel):
    type: str = Field(max_length=24)
    title: str = Field(max_length=500)
    description: str | None = None
    scheduled_at: datetime
    timezone: str = "UTC"
    recurrence_rule: str | None = Field(default=None, max_length=128)
    priority: str = Field(default="normal", pattern="^(low|normal|high|urgent)$")
    quiet_hours_ok: bool = False
    related_entity_type: str | None = Field(default=None, max_length=32)
    related_entity_id: uuid.UUID | None = None

class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    scheduled_at: datetime | None = None
    timezone: str | None = None
    recurrence_rule: str | None = Field(default=None, max_length=128)
    priority: str | None = Field(default=None, pattern="^(low|normal|high|urgent)$")
    quiet_hours_ok: bool | None = None
    snoozed_until: datetime | None = None
    status: str | None = Field(default=None, pattern="^(scheduled|completed|cancelled)$")

class ReminderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    type: str
    title: str
    description: str | None
    scheduled_at: datetime
    timezone: str
    recurrence_rule: str | None
    status: str
    priority: str
    snoozed_until: datetime | None
    quiet_hours_ok: bool
    related_entity_type: str | None
    related_entity_id: uuid.UUID | None
    created_at: datetime


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    reminder_id: uuid.UUID | None
    type: str
    title: str
    body: str | None
    related_entity_type: str | None
    related_entity_id: uuid.UUID | None
    read_at: datetime | None
    delivered_at: datetime | None
    channel: str
    snoozed_until: datetime | None
    created_at: datetime
