from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "BE'EMUNA"
    environment: str = "development"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = "postgresql+psycopg://beemuna:your_password@localhost:5432/beemuna"
    redis_url: str = "redis://localhost:6379/0"

    api_prefix: str = "/api/v1"
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:3001",
        "http://0.0.0.0:3002",
        "http://0.0.0.0:3003",
        "https://beemuna.vercel.app",
    ]

    # AI Provider — BEEMUNA AI Gateway
    ai_provider: str = "gemini"
    ai_model: str = "gemini-3.1-flash-lite"
    ai_base_url: str = ""
    ai_api_key: str = ""
    ollama_url: str = "http://localhost:11434"
    ollama_keep_alive: str = "30m"
    ollama_num_ctx: int = 1024
    ollama_num_batch: int = 512
    ollama_num_threads: int = 6
    embedding_provider: str = "openai_compatible"
    embedding_model: str = "nomic-embed-text"
    embedding_dimensions: int = 768
    openai_api_key: str = ""

    # Gemini (Primary + Reasoning)
    gemini_api_key: str = ""
    gemini_primary_model: str = "gemini-3.1-flash-lite"
    gemini_reasoning_model: str = "gemini-2.5-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    # NVIDIA Cloud AI (Fallback + Multimodal)
    nvidia_api_key: str = ""
    nvidia_fallback_model: str = "glm-5.2"
    nvidia_multimodal_model: str = "nemotron-3-nano-omni-30b-a3b-reasoning"
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"

    # Storage
    upload_dir: str = "./data/uploads"
    max_upload_bytes: int = 25 * 1024 * 1024

    # Notifications
    default_quiet_hours_start: str = "22:00"
    default_quiet_hours_end: str = "07:00"
    default_timezone: str = "Africa/Addis_Ababa"

    # Billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_pro_monthly: str = ""

    # Auth
    register_enabled: bool = True
    rate_limit_requests: int = 60
    rate_limit_window_seconds: int = 60

    # Google OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "BE'EMUNA <noreply@beemuna.app>"
    email_verify_token_expire_hours: int = 48

    @property
    def jwt_algorithm(self) -> str:
        return "HS256"

    @model_validator(mode="after")
    def enforce_secure_secret_key(self):
        if not self.secret_key or self.secret_key in ("change-me", "change-me-to-a-long-random-string"):
            raise ValueError(
                "SECRET_KEY must be set to a secure random value. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(64))\""
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
