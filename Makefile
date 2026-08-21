.PHONY: test migrate makemigrations dev web api worker

test:
	cd apps/api && .venv/Scripts/python.exe -m pytest tests -q

migrate:
	cd apps/api && .venv/Scripts/alembic.exe upgrade head

makemigrations:
	cd apps/api && .venv/Scripts/alembic.exe revision --autogenerate -m "$(m)"

web:
	cd apps/web && npm run dev

api:
	cd apps/api && .venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8002

worker:
	cd apps/api && .venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8002 & cd workers && ..\\apps\api\\.venv\\Scripts\\python.exe worker.py

dev: api worker web
