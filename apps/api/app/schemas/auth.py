import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr | None
    name: str | None
    avatar_url: str | None
    religion: str
    email_verified: bool
    timezone: str
    language: str
    theme: str
    calendar_mode: str
    numeral_mode: str
    quiet_hours_start: str
    quiet_hours_end: str
    ai_access: dict[str, bool]
    ai_perspective: str
    ai_local_enabled: bool
    ai_local_model: str | None
    ai_cloud_model: str | None
    ai_memory_enabled: bool
    ai_journal_context: bool
    ai_save_new_memories: bool
    notification_channels: dict[str, bool]
    city: str | None
    profile_completed_at: datetime | None
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=120)
    religion: str = Field(default="unspecified", pattern="^(christian|muslim|jewish|hindu|buddhist|secular|unspecified)$")

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.isdigit() or len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginIn(BaseModel):
    id_token: str


class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class VerifyEmailIn(BaseModel):
    token: str


class ResendVerificationIn(BaseModel):
    email: EmailStr


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class ProfileUpdateIn(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    city: str | None = Field(default=None, max_length=120)
    timezone: str | None = Field(default=None, max_length=64)
    language: str | None = Field(default=None, pattern="^(en|am)$")
    theme: str | None = Field(default=None, pattern="^(system|light|dark)$")
    calendar_mode: str | None = Field(default=None, pattern="^(gregorian|ethiopian|dual)$")
    numeral_mode: str | None = Field(default=None, pattern="^(western|geez|both)$")
    quiet_hours_start: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    quiet_hours_end: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    ai_access: dict[str, bool] | None = None
    ai_local_enabled: bool | None = None
    ai_local_model: str | None = Field(default=None, max_length=64)
    ai_cloud_model: str | None = Field(default=None, max_length=64)
    ai_memory_enabled: bool | None = None
    ai_journal_context: bool | None = None
    ai_save_new_memories: bool | None = None
    notification_channels: dict[str, bool] | None = None


class MessageOut(BaseModel):
    message: str


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ip: str | None
    user_agent: str | None
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
