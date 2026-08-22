# BE'EMUNA

> **Your time. Your knowledge. Your direction.**

BE'EMUNA is a full-stack personal operating system for productivity, journaling, knowledge management, and AI-powered assistance.

## Live

- **Frontend** — https://beemuna.vercel.app
- **Backend API** — https://beemuna-production.up.railway.app/api/v1/docs

## Features

- **Projects & Tasks** — nested projects, tasks, and subtasks
- **Goals & Milestones** — track outcomes and progress
- **Habits** — habit tracking with per-day completions
- **Journal** — private daily journaling with mood, tags, and media attachments
- **Notes** — rich notes with folder organization
- **Calendar** — native **Gregorian + Ethiopian** support with Ge'ez numerals and Amharic month names, plus **Hijri** and faith-aware holiday helpers
- **Focus & Timeline** — Pomodoro-style focus sessions and a life-timeline view
- **Knowledge Base / RAG** — spaces, sources, document chunking, embeddings (pgvector), concepts, relationships, and citations
- **AI Assistant** — NVIDIA cloud-powered conversational AI with conversation memory, application data context, worldview-aware system prompts, and streaming responses
- **Reminders & Notifications** — schedule-aware reminders with quiet hours
- **Faith Tools** — Bible-verse inspiration, faith-aware reminders and content

## Architecture

```
beemuna/
├── apps/
│   ├── web/                 Next.js 16 + TypeScript + Tailwind v4 frontend
│   └── api/                 FastAPI + SQLAlchemy + Alembic backend
├── workers/                 Python background workers (RQ + scheduler thread)
├── infrastructure/
│   └── docker/              Container definitions (Dockerfile)
└── tests/                   Test assets
```

## Stack

| Layer     | Tech |
|-----------|------|
| Backend   | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| Database  | PostgreSQL 16 + pgvector (Supabase) |
| Cache     | Upstash Redis |
| Frontend  | Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, TanStack Query, Radix UI |
| Auth      | Argon2 password hashing, JWT (HS256), Google OAuth |
| AI        | NVIDIA API (Llama 3.1 8B / 70B) with streaming |

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | https://beemuna.vercel.app |
| Backend | Railway | https://beemuna-production.up.railway.app |
| Database | Supabase | PostgreSQL + pgvector |
| Cache | Upstash | Redis |

- **Dockerfile** — Python 3.12-slim, runs Alembic migrations on startup, then Uvicorn
- **Railway** — auto-deploys from GitHub (`RazForge/beemuna`, `main` branch)
- **Vercel** — auto-deploys from GitHub

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 22+
- Docker (for local Postgres + Redis)

### 1. Configure environment

```bash
cp .env.example .env
# edit .env — set DATABASE_URL, NVIDIA_API_KEY, SECRET_KEY, etc.
```

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on `:5432` and Redis on `:6379`.

### 3. Run the API

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8002 --timeout-keep-alive 300
```

API docs at `http://localhost:8002/docs`.

### 4. Run the web frontend

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3002`.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SECRET_KEY` | JWT signing secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NVIDIA_API_KEY` | NVIDIA API key for cloud AI |
| `AI_CLOUD_MODEL` | Cloud AI model (`meta/llama-3.1-8b-instruct` or `meta/llama-3.1-70b-instruct`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI |
| `NEXT_PUBLIC_API_URL` | Web → API base URL |
| `NEXT_PUBLIC_APP_URL` | Web origin |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client ID (frontend) |

## API Surface

Routers under `/api/v1`:

`auth`, `projects`, `tasks`, `goals`, `journal`, `notes`, `habits`, `calendar`, `focus`, `timeline`, `knowledge`, `ai`, `reminders`, `health`

## Data Model

Key entities (SQLAlchemy models in `apps/api/app/models/`):

- **Identity**: `User` (religion, calendar_mode, ai_access, auth_provider), `Session`
- **Productivity**: `Project`, `Task`, `Subtask`, `Goal`, `Milestone`, `Habit`, `HabitCompletion`, `CalendarEvent`, `FocusSession`
- **Content**: `JournalEntry`, `Note`, `NoteFolder`, `TimelineItem`
- **Knowledge**: `KnowledgeSpace`, `Source`, `DocumentChunk`, `Embedding`, `Concept`, `Relationship`, `Citation`
- **AI**: `AIConversation`, `AIMessage`, `AIMemory`
- **System**: `Reminder`, `Notification`

Migrations in `apps/api/alembic/versions/`.

## Security

- Passwords hashed with **Argon2**
- Identity derived from server-side auth context — never from client-supplied IDs
- Every query enforces ownership
- AI/RAG scoped by `user_id`
- Journal content is **private by default** and never auto-fed to AI
- CORS allow-list, rate limiting, secure session tokens

## Test Account

- Email: `test@razforge.com`
- Password: `Test1234!`

## License

Private / proprietary.
