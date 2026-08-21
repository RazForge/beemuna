# Migrations

## Generate
```bash
cd apps/api
.venv/Scripts/alembic.exe revision --autogenerate -m "describe your change"
```

## Review
Always inspect `apps/api/alembic/versions/*.py` before applying. Autogenerate misses:
- Column `nullable` changes
- Unique constraints
- Data migrations

## Apply
```bash
cd apps/api
.venv/Scripts/alembic.exe upgrade head
```

## Rollback
```bash
.venv/Scripts/alembic.exe downgrade -1
```
