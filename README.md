<div align="center">

# BE'EMUNA

**Your time. Your knowledge. Your direction.**

A full-stack personal productivity OS with AI-powered assistance, faith-aware design, and universal worldview personalization.

[![CI](https://github.com/RazForge/beemuna/actions/workflows/ci.yml/badge.svg)](https://github.com/RazForge/beemuna/actions)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://python.org)
[![Next.js 16](https://img.shields.io/badge/next.js-16-black)](https://nextjs.org)

[Live App](https://beemuna.vercel.app) · [API Docs](https://beemuna-production.up.railway.app/api/v1/docs)

</div>

---

## What is BE'EMUNA?

BE'EMUNA is a personal productivity platform that combines task management, journaling, knowledge management, habit tracking, focus sessions, and AI assistance into one unified experience. It supports **Gregorian, Ethiopian, and Hijri** calendars, and adapts its AI behavior based on the user's faith worldview — Christian, Muslim, or non-religious.

---

## Features

### Productivity Engine

- **Projects & Tasks** — Create projects with nested tasks and subtasks. Set priorities, due dates, and track completion rates.
- **Goals & Milestones** — Define long-term goals with milestones and track progress over time.
- **Habits** — Daily/weekly habit tracking with streaks, completion history, reminder times, color coding, and activity checklists.
- **Focus Mode** — Pendulum-style focus timer with background reliability, tab-switch alerts, completion melodies, and religion-based AI encouragement quotes that rotate every minute.

### Knowledge & Reflection

- **Journal** — Private daily journaling with mood tracking (5 levels), entry types (Diary, Todo, Gratitude, Idea, Prayer), voice typing (Speech-to-Text), voice memo recording (5-min max), rich text editor, and media attachments (YouTube, Spotify, images, audio, files).
- **Notes** — Rich notes with folder organization.
- **Knowledge Base (RAG)** — Knowledge spaces with document upload, text chunking, pgvector embeddings, AI-powered search with citations, mind map generation, and Be'emuna Note summaries.

### Intelligence

- **AI Assistant** — Cloud-powered conversational AI with streaming (SSE), conversation memory, multiple modes (Assistant, Research, Reflection, Planner), and auto-extracted facts.
- **Be'emuna AI Gateway** — 4-model fallback chain: Primary → Reasoning → Fallback → Multimodal. All responses display as "Beemuna AI".
- **Auto-Memory** — The AI remembers important details from your conversations.
- **Application Data Context** — The AI knows about your tasks, journal entries, goals, and habits.
- **Mind Map Generation** — AI generates mind maps from your knowledge sources.
- **Summarization** — AI summarizes documents and notes.

### Faith & Culture

- **3 Worldviews** — Christian, Muslim, or Unspecified (set at registration, immutable after).
- **Faith-Aware AI** — System prompts adapt to your worldview. Muslim users get Quran references, Christian users get Bible verses, non-religious users get philosophical quotes.
- **Triple Calendar** — Gregorian, Ethiopian (with Ge'ez numerals), and Hijri support with religion-based holidays.
- **Religion-Based Quotes** — Focus mode displays rotating faith-based encouragement quotes.

### Journey & Gamification

- **16 Progress Paths** — Productivity, Knowledge, Reflection, Learning, Health & Fitness, Financial Growth, Career Development, Creativity, Social Connections, Mindfulness, Spirituality, Communication, Leadership, Travel & Culture, Home & Lifestyle, Technology.
- **26 Achievements** — Bronze, Silver, and Gold tiers across categories like Productivity, Knowledge, Health, Faith, Reflection, Intelligence, Learning, and General.
- **Life Score** — Overall life score calculated from productivity, knowledge, health, faith, and learning metrics.
- **Timeline** — Visual timeline of all your achievements and activities.

### Reminders & Notifications

- **Scheduled Reminders** — Time-based reminders with browser notifications and alarm sounds.
- **Quick Time Selection** — 15m, 30m, 1h, 2h, Tomorrow presets.
- **Pendulum Clock Picker** — Beautiful analog clock time picker with animated pendulum.
- **Habit Reminders** — Per-habit reminder times with browser notifications.

### Dashboard

- **Real-Time Clock** — SVG analog pendulum clock with live hands.
- **Triple Calendar Display** — Shows current date in Gregorian, Ethiopian, and Hijri calendars.
- **Faith Widget** — Verse of the Day (Christian), Ayah of the Day (Muslim), or Quote of the Day (non-religious).
- **Quick Stats** — Knowledge notebooks, tasks completed, habit streaks, focus hours, active goals.
- **Reminders Panel** — Quick access to today's reminders.

### Mobile App

- **Android APK** — Built with Expo (React Native), available at `~/Desktop/BEEMUNA.apk`.
- **Mobile-First Design** — Responsive across all devices with glass morphism UI.

---

## Architecture

```
beemuna/
├── apps/
│   ├── web/                          # Next.js 16 + React 19 + TypeScript + Tailwind v4
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (app)/            # Authenticated app pages
│   │   │   │   │   ├── dashboard/    # Home dashboard with clock, stats, faith widget
│   │   │   │   │   ├── tasks/        # Task management
│   │   │   │   │   ├── goals/        # Goals and milestones
│   │   │   │   │   ├── habits/       # Habit tracking
│   │   │   │   │   ├── focus/        # Focus timer with pendulum
│   │   │   │   │   ├── journal/      # Daily journaling
│   │   │   │   │   ├── notes/        # Notes management
│   │   │   │   │   ├── knowledge/    # Knowledge base (RAG)
│   │   │   │   │   ├── ai/           # AI chat interface
│   │   │   │   │   ├── calendar/     # Triple calendar
│   │   │   │   │   ├── reminders/    # Reminders
│   │   │   │   │   └── journey/      # Achievements, paths, life score
│   │   │   │   ├── (auth)/           # Auth pages (login, register)
│   │   │   │   └── layout.tsx        # Root layout
│   │   │   ├── components/           # Reusable UI components
│   │   │   ├── context/              # React context (auth)
│   │   │   ├── hooks/                # Custom hooks
│   │   │   └── lib/                  # Utilities, API client, i18n, faith
│   │   └── public/
│   │       └── images/               # Static assets (logo, etc.)
│   └── api/                          # FastAPI + SQLAlchemy + Alembic
│       ├── app/
│       │   ├── api/v1/               # API route handlers
│       │   ├── models/               # SQLAlchemy models
│       │   ├── schemas/              # Pydantic schemas
│       │   ├── services/             # Business logic (AI, context, journey, timeline)
│       │   ├── core/                 # Config, database, security
│       │   └── migrations/           # Alembic migrations
│       └── alembic/                  # Alembic config and versions
├── workers/                          # Background workers (RQ + scheduler)
├── infrastructure/
│   └── docker/                       # Dockerfiles
└── tests/
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS v4, TanStack Query, Radix UI, Framer Motion |
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| **Database** | PostgreSQL 16 + pgvector (vector embeddings) |
| **Cache** | Redis (Upstash) |
| **Auth** | Argon2 hashing, JWT (HS256), Google OAuth 2.0 |
| **AI** | Be'emuna AI Gateway — Multi-model fallback chain with streaming |
| **Mobile** | Expo (React Native) — Android APK |
| **Frontend Deploy** | Vercel |
| **Backend Deploy** | Railway |
| **Database Host** | Supabase (PostgreSQL 16 + pgvector) |
| **Cache Host** | Upstash (Redis) |

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 22+ (Node.js 24 causes Bus error with Next.js 16)
- Docker (for local Postgres + Redis)
- Git

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

---

## Environment Variables

```bash
# ── Required ──────────────────────────────────────────────
SECRET_KEY=              # JWT signing secret (64-byte random hex)
DATABASE_URL=            # PostgreSQL connection string
REDIS_URL=               # Redis connection string

# ── AI Provider ───────────────────────────────────────────
AI_PROVIDER=             # openai_compatible
AI_MODEL=                # Primary model name
AI_BASE_URL=             # API endpoint
AI_API_KEY=              # API key for your AI provider

# Fallback models
AI_REASONING_MODEL=      # Reasoning model
AI_FALLBACK_MODEL=       # Fallback model
AI_MULTIMODAL_MODEL=     # Multimodal model

# NVIDIA API key (for fallback models)
NVIDIA_API_KEY=

# ── Google OAuth ──────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=     # https://your-api.up.railway.app/api/v1/auth/google/callback

# ── Frontend ──────────────────────────────────────────────
NEXT_PUBLIC_API_URL=     # https://your-api.up.railway.app/api/v1
NEXT_PUBLIC_APP_URL=     # https://your-app.vercel.app
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

---

## API Surface

All endpoints under `/api/v1`:

| Router | Description | Key Endpoints |
|--------|-------------|---------------|
| `auth` | Registration, login, Google OAuth, password reset | `POST /login`, `POST /register`, `GET /me`, `POST /google` |
| `projects` | Projects, tasks, subtasks, blocks | `GET/POST /projects`, `POST /projects/{id}/tasks` |
| `goals` | Goals and milestones | `GET/POST /goals`, `POST /goals/{id}/milestones` |
| `journal` | Journal entries with mood and media | `GET/POST /journal`, `PATCH /journal/{id}` |
| `notes` | Notes and folders | `GET/POST /notes`, `GET/POST /notes/folders` |
| `habits` | Habit tracking and completions | `GET/POST /habits`, `POST /habits/{id}/completions` |
| `focus` | Focus sessions | `GET/POST /focus`, `PATCH /focus/{id}` |
| `knowledge` | Knowledge spaces, sources, embeddings, RAG search | `GET/POST /knowledge/spaces`, `POST /knowledge/search` |
| `ai` | Chat conversations, streaming, memories | `GET/POST /ai/conversations`, `POST /ai/conversations/{id}/messages/stream` |
| `journey` | Achievements, progress paths, life score | `GET /journey/achievements`, `GET /journey/paths`, `GET /journey/life-score` |
| `reminders` | Scheduled reminders with quiet hours | `GET/POST /reminders`, `PATCH /reminders/{id}` |
| `timeline` | Timeline of all activities | `GET /timeline`, `DELETE /timeline` |
| `analytics` | Dashboard analytics | `GET /analytics/dashboard` |

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel | [beemuna.vercel.app](https://beemuna.vercel.app) |
| Backend | Railway | [beemuna-production.up.railway.app](https://beemuna-production.up.railway.app) |
| Database | Supabase | PostgreSQL 16 + pgvector (AWS EU-West-1) |
| Cache | Upstash | Redis (TLS) |
| Mobile | Local Build | `~/Desktop/BEEMUNA.apk` |

---

## Security

- Passwords hashed with **Argon2** (not bcrypt)
- Identity derived from server-side auth — never from client-supplied IDs
- Every query enforces ownership (multi-tenant by design)
- AI and RAG scoped by `user_id`
- Journal content is **private by default** — never auto-fed to AI
- Religion is **immutable after registration** — cannot be changed
- CORS allow-list, rate limiting, secure session tokens
- All secrets excluded from git via `.gitignore`
- No hardcoded credentials in source code
- CORS configured for `localhost:3002`, `localhost:3000`, and production domains

---

## Test Accounts

| Email | Password | Religion |
|-------|----------|----------|
| test@razforge.com | Test1234! | Muslim |
| demo@razforge.com | Demo1234! | Christian |

---

## AI Gateway Architecture

BE'EMUNA uses a 4-model fallback chain for AI responses:

```
User Request
    │
    ▼
┌─────────────────────────────┐
│  Primary Model              │  ← Fastest, most efficient
│  (15s timeout)              │
└─────────────┬───────────────┘
              │ timeout/error
              ▼
┌─────────────────────────────┐
│  Reasoning Model            │  ← Advanced reasoning
│  (15s timeout)              │
└─────────────┬───────────────┘
              │ timeout/error
              ▼
┌─────────────────────────────┐
│  Fallback Model             │  ← Cloud fallback
│  (15s timeout)              │
└─────────────┬───────────────┘
              │ timeout/error
              ▼
┌─────────────────────────────┐
│  Multimodal Model           │  ← Final fallback
│  (15s timeout)              │
└─────────────────────────────┘
```

- All providers display as **"Beemuna AI"** (no provider names exposed)
- Context builder maps user worldview to faith-aware system prompts
- Streaming via Server-Sent Events (SSE)
- Auto-memory extracts facts from conversations

---

## Journey System

### 16 Progress Paths

| Path | Category | Metric |
|------|----------|--------|
| Productivity | Productivity | Tasks completed |
| Knowledge | Knowledge | Notes + documents |
| Reflection | Reflection | Journal entries |
| Learning | Learning | Notes + documents + AI conversations |
| Health & Fitness | Health | Habit streaks + focus sessions |
| Financial Growth | Productivity | Tasks completed |
| Career Development | Productivity | Tasks + projects |
| Creativity | Reflection | Notes created |
| Social Connections | Faith | Days active |
| Mindfulness | Faith | Journal + habits |
| Spirituality | Faith | Journal entries |
| Communication | Knowledge | AI conversations + notes |
| Leadership | Productivity | Projects + tasks |
| Travel & Culture | Learning | Notes + documents |
| Home & Lifestyle | Health | Tasks + habits |
| Technology | Learning | Notes + documents + AI conversations |

### 26 Achievements

- **Productivity**: First Steps, Task Master, Productivity King, Goal Setter, Goal Crusher
- **Knowledge**: Note Taker, Knowledge Seeker, Wisdom Collector, Wisdom Master
- **Health**: Health Conscious, Fitness Warrior, Health Champion
- **Faith**: Faithful Soul, Spiritual Warrior, Faith Champion
- **Reflection**: Introspective, Deep Thinker, Reflection Master
- **Intelligence**: AI Curious, AI Collaborator, AI Master
- **Learning**: Learning Journey, Knowledge Architect, Learning Master
- **General**: Consistent, Dedicated, Legendary

---

## License

Private / proprietary. Contact [RazForge](https://github.com/RazForge) for access.
