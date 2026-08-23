# Deployment

## Prerequisites
- Docker + Docker Compose
- `.env` at project root (copy from `.env.example` and fill in values)

## Start
```bash
docker compose up --build
```

Services:
- API → http://localhost:8002
- Web → http://localhost:3001
- Postgres → localhost:5433
- Redis → localhost:6380

## Environment variables
See `.env.example`. Required:
- `SECRET_KEY` — 64-byte hex from `python -c "import secrets; print(secrets.token_hex(64))"`
- `DATABASE_URL` / `REDIS_URL` — set in compose, override if needed
- `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` — required in production for email verification/reset

## Migrations
```bash
cd apps/api
.venv/Scripts/alembic.exe upgrade head
```

## Worker
```bash
cd workers
..\apps\api\.venv\Scripts\python.exe worker.py
```
