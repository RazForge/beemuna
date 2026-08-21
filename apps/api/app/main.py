from fastapi import APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.api.v1 import ai, ai_setup, auth, calendar, focus, goals, habits, journal, knowledge, notes, projects, reminders, tasks, timeline
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.rate_limit import RateLimitMiddleware

configure_logging()

app = FastAPI(
    title=settings.app_name,
    docs_url="/docs" if settings.environment == "development" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.add_middleware(
    RateLimitMiddleware,
    exempt={"/api/v1/auth/login", "/api/v1/health", "/api/v1/auth/register"},
)

api = APIRouter(prefix=settings.api_prefix)
api.include_router(auth.router)
api.include_router(projects.router)
api.include_router(tasks.router)
api.include_router(goals.router)
api.include_router(journal.router)
api.include_router(notes.router)
api.include_router(habits.router)
api.include_router(calendar.router)
api.include_router(focus.router)
api.include_router(timeline.router)
api.include_router(knowledge.router)
api.include_router(ai.router)
api.include_router(ai_setup.router)
api.include_router(reminders.router)


@app.get("/api/v1/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "app": settings.app_name, "version": "0.1.0"}


app.include_router(api)
