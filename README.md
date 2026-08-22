<div align="center">

# BE'EMUNA

**Your time. Your knowledge. Your direction.**

A full-stack personal operating system for productivity, journaling, knowledge management, and AI-powered assistance — built with faith-aware design.

[![CI](https://github.com/RazForge/beemuna/actions/workflows/ci.yml/badge.svg)](https://github.com/RazForge/beemuna/actions)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://python.org)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black)](https://nextjs.org)

[Live App](https://beemuna.vercel.app) · [API Docs](https://beemuna-production.up.railway.app/api/v1/docs)

</div>

---

## What is BE'EMUNA?

BE'EMUNA is a personal productivity platform that combines task management, journaling, knowledge base, and AI assistance into one unified experience. It supports **Gregorian, Ethiopian, and Hijri** calendars, and adapts its AI behavior based on the user's faith worldview.

## Features

### Productivity
- **Projects & Tasks** — nested projects, tasks, and subtasks with priorities
- **Goals & Milestones** — track outcomes and measure progress
- **Habits** — daily habit tracking with streaks and completions
- **Focus Mode** — Pomodoro-style focus sessions with background timer and completion sound

### Knowledge & Reflection
- **Journal** — private daily journaling with mood tracking, voice typing, and media attachments
- **Notes** — rich notes with folder organization
- **Knowledge Base (RAG)** — spaces, sources, document chunking, embeddings (pgvector), concepts, relationships, and AI-powered citations

### Intelligence
- **AI Assistant** — cloud-powered conversational AI with streaming, conversation memory, and auto-extracted facts
- **Auto-Memory** — the AI remembers important details from your conversations
- **Application Data Context** — the AI knows about your tasks, journal entries, goals, and habits

### Faith & Culture
- **3 Worldviews** — Christian, Muslim, or Unspecified
- **Faith-Aware AI** — system prompts adapt to your worldview
- **Triple Calendar** — Gregorian, Ethiopian (with Ge'ez numerals), and Hijri support
- **Prayer Times** — automatic calculation for Muslim users

### System
- **Reminders & Notifications** — schedule-aware with quiet hours
- **Journey** — achievements, progress paths, and life score
- **Mobile App** — Android APK built with Expo (React Native)
- **Mobile-First Design** — responsive across all devices

## Architecture

```
beemuna/
├── apps/
│   ├── web/                    # Next.js 16 + TypeScript + Tailwind v4
│   └── api/                    # FastAPI + SQLAlchemy + Alembic
├── workers/                    # Background workers (RQ + scheduler)
├── infrastructure/
│   └── docker/                 # Dockerfiles
└── tests/
```

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, TanStack Query, Radix UI |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| **Database** | PostgreSQL 16 + pgvector |
| **Cache** | Redis |
| **Auth** | Argon2 hashing, JWT (HS256), Google OAuth |
| **AI** | Cloud AI via OpenAI-compatible API |
| **Mobile** | Expo (React Native) — Android APK |

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 22+
- Docker (for local Postgres + Redis)

### 1. Clone and configure

```bash
git clone https://github.com/RazForge/beemuna.git
cd beemuna
cp .env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY, AI_API_KEY, etc.
```

### 2. Start infrastructure

```bash
docker compose up -d
```

Starts PostgreSQL on `:5433` and Redis on `:6380`.

### 3. Run the API

```bash
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8002 --timeout-keep-alive 300
```

API docs at `http://localhost:8002/docs`.

### 4. Run the frontend

```bash
cd apps/web
npm install
npm run dev
```

Open `http://localhost:3002`.

## Environment Variables

```bash
# Required
SECRET_KEY=           # JWT signing secret (64-byte random hex)
DATABASE_URL=         # PostgreSQL connection string
REDIS_URL=            # Redis connection string

# AI Provider
AI_PROVIDER=          # openai_compatible
AI_MODEL=             # model name
AI_BASE_URL=          # API endpoint
AI_API_KEY=           # API key for your AI provider

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=  # https://your-api.up.railway.app/api/v1/auth/google/callback

# Frontend
NEXT_PUBLIC_API_URL=  # https://your-api.up.railway.app/api/v1
NEXT_PUBLIC_APP_URL=  # https://your-app.vercel.app
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

## API Surface

All endpoints under `/api/v1`:

| Router | Description |
|--------|-------------|
| `auth` | Registration, login, Google OAuth, password reset |
| `projects` | Projects, tasks, subtasks, blocks |
| `goals` | Goals and milestones |
| `journal` | Journal entries with mood and media |
| `notes` | Notes and folders |
| `habits` | Habit tracking and completions |
| `calendar` | Events and reminders |
| `focus` | Focus sessions |
| `knowledge` | Knowledge spaces, sources, embeddings, RAG search |
| `ai` | Chat conversations, streaming, memories |
| `journey` | Achievements, progress paths, life score |
| `reminders` | Scheduled reminders with quiet hours |
| `analytics` | Dashboard analytics |

## Deployment

| Service | Platform | Status |
|---------|----------|--------|
| Frontend | Vercel | [beemuna.vercel.app](https://beemuna.vercel.app) |
| Backend | Railway | [beemuna-production.up.railway.app](https://beemuna-production.up.railway.app) |
| Database | Supabase | PostgreSQL 16 + pgvector |
| Cache | Upstash | Redis |

## Security

- Passwords hashed with **Argon2**
- Identity derived from server-side auth — never from client-supplied IDs
- Every query enforces ownership (multi-tenant by design)
- AI and RAG scoped by `user_id`
- Journal content is **private by default** — never auto-fed to AI
- CORS allow-list, rate limiting, secure session tokens
- All secrets excluded from git via `.gitignore`
- No hardcoded credentials in source code

## License

Private / proprietary. Contact [RazForge](https://github.com/RazForge) for access.
