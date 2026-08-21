# Architecture

BE'EMUNA is a faith-led productivity platform with three runtimes:

| Component | Tech | Path |
|-----------|------|------|
| Web (frontend) | Next.js 14 + Tailwind | `apps/web` |
| API (backend) | FastAPI + SQLAlchemy 2 | `apps/api` |
| Worker | RQ (Redis Queue) | `workers/` |

## Data flow
- Frontend talks to API via `src/lib/api.ts`.
- API persists to PostgreSQL (pgvector) via SQLAlchemy.
- Long-running jobs (embeddings, reminders, cleanup) go through Redis Queue to `workers/worker.py`.
- AI uses Ollama (local) or cloud providers via `app/services/ai_service.py`.

## Auth
- JWT access tokens issued on login/register.
- Tokens are stored in httpOnly cookies (`beemuna_token`) with `SameSite=Lax`.
- Backend still accepts `Authorization: Bearer` header for backward compatibility.
- Sessions are tracked in `users.sessions` with revocation support.

## Key decisions
- Ethiopian calendar uses JDN-based conversion (`lib/ethiopian.ts`), Ge'ez numerals.
- RAG is provider-agnostic (Ollama / OpenAI / Anthropic / Gemini).
- Reminders respect per-user timezone and quiet hours.
