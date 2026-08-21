# BE'EMUNA

> **Your time. Your knowledge. Your direction.**

BE'EMUNA is a full-stack personal operating system for productivity, timeline/journaling, knowledge management, research, and AI-powered assistance.

It is a **monorepo** containing a Next.js frontend, a FastAPI backend, background workers, and shared packages, designed to be production-ready and self-hostable.

**Wait — this is a stub README, not the real thing.** The version you asked me to "complete" was already fairly complete. If you wanted a *full rewrite*, say so and I'll rewrite it wholesale. Otherwise here's the drift between the stub above and the code as it actually exists, which I've now corrected.

---

## Feature highlights

- **Projects & Tasks** — nested projects, tasks, and subtasks ([`projects.py`](apps/api/app/api/v1/projects.py), [`tasks.py`](apps/api/app/api/v1/tasks.py))
- **Goals & Milestones** — track outcomes and progress toward them (`goals.py`)
- **Habits** — habit tracking with per-day completions (`habits.py`)
- **Journal** — private, encrypted-at-rest-capable daily journaling; **never auto-fed to AI** by default (`journal.py`)
- **Notes** — rich notes with folder organization (`notes.py`)
- **Calendar** — native **Gregorian + Ethiopian** support with Ge'ez numerals and Amharic month names, plus **Hijri** and holiday helpers (`calendar.py`, [`ethiopian.ts`](apps/web/src/lib/ethiopian.ts), [`hijri.ts`](apps/web/src/lib/hijri.ts), [`faith.ts`](apps/web/src/lib/faith.ts))
- **Focus & Timeline** — Pomodoro-style focus sessions and a life-timeline view (`focus.py`, `timeline.py`, `timeline_service.py`)
- **Knowledge base / RAG** — spaces, sources, document chunking, embeddings (pgvector), concepts, relationships, and citations (`knowledge.py`, [`rag.py`](apps/api/app/services/rag.py), [`embedding_service.py`](apps/api/app/services/embedding_service.py), [`document_processor.py`](apps/api/app/services/document_processor.py))
- **AI assistant** — provider-agnostic chat over your scoped data (`ai.py`, `ai_service.py`)
- **Reminders & Notifications** — schedule-aware reminders with quiet hours (`reminders.py`, `notifications`)
- **Faith tools** — Bible-verse inspiration, faith-aware reminders and content (`faith.ts`)

## Architecture

```
beemuna/
├── apps/
│   ├── web/                 Next.js 16 + TypeScript + Tailwind v4 frontend
│   └── api/                 FastAPI + SQLAlchemy + Alembic backend
├── packages/                Shared config / types / ui / utils (monorepo workspace)
├── workers/                 Python background workers (RQ + scheduler thread)
├── infrastructure/
│   ├── docker/              Container definitions (Dockerfiles)
│   └── migrations/          SQL migration assets
├── tests/                   Shared test assets
└── docs/                    Architecture & operations docs
```

Web routes mirror the API: `dashboard`, `projects`, `tasks`, `goals`, `habits`, `journal`, `notes`, `calendar`, `focus`, `timeline`, `knowledge`, `ai`, `settings`.

## Core stack

| Layer     | Tech |
|-----------|------|
| Backend   | Python 3.14, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database  | PostgreSQL 17 + pgvector |
| Queues    | Redis 7 + RQ |
| Frontend  | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, TanStack Query, Zod, Radix UI, TipTap, Framer Motion |
| Auth      | Argon2 password hashing, JWT (HS256) + server-side sessions |
| AI        | Provider abstraction: Ollama, OpenAI-compatible, OpenAI, Anthropic, Gemini-compatible |

## Getting started

### Prerequisites

- Docker (PostgreSQL + Redis run in containers)
- Python 3.14+
- Node.js 20+

### 1. Configure environment

```bash
cp .env.example .env
# edit .env — set SECRET_KEY, pick an AI provider, etc.
```

### 2. Start the infrastructure

```bash
docker compose up -d
```

Starts `postgres` on `:5433` and `redis` on `:6380` (host ports deliberately offset to avoid colliding with any local Postgres/Redis).

### 3. Run the API

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # Windows, or python3 -m venv on POSIX
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs (Swagger UI) at `http://localhost:8000/docs` when `ENVIRONMENT=development`.

### 4. Run the worker

```bash
cd workers
pip install -r ../apps/api/requirements.txt
python worker.py
```

Runs RQ worker for `documents`, `ai`, and `default` queues plus a scheduler loop for reminders, document processing, embedding, and cleanup.

### 5. Run the web frontend

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3002` (see `NEXT_PUBLIC_APP_URL`). The `(app)` route group is guarded by [`auth-guard.tsx`](apps/web/src/components/layout/auth-guard.tsx).

## Environment variables

All variables are documented in [`.env.example`](.env.example):

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | `change-me...` | JWT signing secret — **change in production** |
| `DATABASE_URL` | `postgresql+psycopg://beemuna:beemuna_dev@localhost:5433/beemuna` | SQLAlchemy connection string |
| `REDIS_URL` | `redis://localhost:6380/0` | Queue + cache backend |
| `AI_PROVIDER` | `ollama` | `ollama \| openai \| openai_compatible \| anthropic \| gemini` |
| `AI_MODEL` / `EMBEDDING_MODEL` | `llama3.1` / `nomic-embed-text` | Model names |
| `EMBEDDING_DIMENSIONS` | `768` | pgvector vector size — **must match migration** |
| `OLLAMA_URL` | `http://localhost:11434` | Local Ollama endpoint |
| `STRIPE_*` | *(empty)* | Billing (optional, free-plan default) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8002/api/v1` | Web → API base (used by [`lib/api.ts`](apps/web/src/lib/api.ts)) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3002` | Web origin for CORS |

Authentication is registered on `/api/v1/auth` (`register`/`login`/`logout`), rate-limited traffic is enforced by [`rate_limit.py`](apps/api/app/core/rate_limit.py) (login and health exempt).

## API surface

Routers mounted under `/api/v1` in [`main.py`](apps/api/app/main.py):

`auth`, `projects`, `tasks`, `goals`, `journal`, `notes`, `habits`, `calendar`, `focus`, `timeline`, `knowledge`, `ai`, `reminders`, plus `GET /api/v1/health`.

## Data model

Key entities (SQLAlchemy models under [`apps/api/app/models/`](apps/api/app/models/)):

- **Identity**: `User` (incl. `religion`, `calendar_mode`, `ai_access` JSONB matrix), `Session`, `Subscription` (Stripe-backed)
- **Productivity**: `Project`, `Task`, `Subtask`, `Goal`, `Milestone`, `Habit`, `HabitCompletion`, `CalendarEvent`, `FocusSession`
- **Content**: `JournalEntry`, `Note`, `NoteFolder`, `TimelineItem`
- **Knowledge**: `KnowledgeSpace`, `Source`, `DocumentChunk`, `Embedding`, `Concept`, `Relationship`, `Citation`
- **AI**: `AIConversation`, `AIMessage`
- **System**: `Reminder`, `Notification`, `AuditLog`

Migrations live in [`apps/api/alembic/versions/`](apps/api/alembic/versions/).

## Background workers

[`workers/`](workers/) runs on Redis queues:

- `documents` — upload ingestion: parse PDF/DOCX/Markdown → chunk → store chunks (`document_processing.py`, `db.py`)
- `ai` — AI responses and embedding jobs (`ai_jobs.py`)
- `default` — general jobs
- **Scheduler loop** (every 30s) — deliver reminders, process pending documents, embed pending sources, housekeeping every 6h (`cleanup.py`, `reminders.py`)

## Security model

- Passwords hashed with **Argon2**
- Identity always derived from the authenticated server context — never from client-supplied IDs (see [`deps.py`](apps/api/app/api/deps.py))
- Every user-owned query enforces ownership
- AI/RAG retrieval scoped by `user_id + knowledge_space_id + source` permissions
- Journal content is **private by default** and never auto-fed to AI (`ai_access` defaults to `journal: false`)
- Secure file uploads with size caps, rate limiting, CORS allow-list, audit logging
- Session tokens stored hashed

## Docker

Full app (API + worker) is defined in [`docker-compose.yml`](docker-compose.yml) but the `api` and `worker` services require the Dockerfiles in `infrastructure/docker/` — **note: those Dockerfiles are not yet committed** (the directory exists but is empty). Until they're added, run the API and worker on the host against the containerized Postgres/Redis.

## Tests

```bash
cd apps/api
pytest
```

Current suites cover auth API flow and calendar conversion (`tests/test_auth_api.py`, `tests/test_calendar.py`).

## Status

Working scaffold: full API surface, migrations, web pages for every feature area, worker skeleton, RAG pipeline, and dual-calendar logic are in place. Not-yet-done: Dockerfiles for api/worker, `packages/*` are empty workspace dirs, `tests/` and `docs/` are empty, and the web app is still largely default `create-next-app` scaffolding behind the route folders.

## License

Private / proprietary. No license file has been committed yet.