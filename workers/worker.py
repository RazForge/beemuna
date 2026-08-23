import logging
import time
import uuid

from rq import Queue, Worker
from rq.job import Job

from db import session_scope
from ai_jobs import ai_respond, embed_source, embed_pending_sources
from cleanup import run_cleanup
from document_processing import process_source, run_pending_documents
from reminders import run_reminders_loop

from redis import Redis

from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()
log = logging.getLogger("beemuna-worker")


def job_process_source(source_id: str) -> str:
    source_uuid = uuid.UUID(source_id)
    with session_scope() as db:
        return process_source(db, source_uuid)


def job_embed_source(source_id: str) -> str:
    source_uuid = uuid.UUID(source_id)
    with session_scope() as db:
        return embed_source(db, source_uuid)


def job_ai_respond(user_id: str, space_id: str | None, prompt: str, mode: str) -> str:
    with session_scope() as db:
        return ai_respond(db, uuid.UUID(user_id), uuid.UUID(space_id) if space_id else None, prompt, mode)


def scheduler_loop(redis_conn: Redis) -> None:
    log.info("scheduler started")
    last_cleanup = 0.0
    while True:
        try:
            with session_scope() as db:
                sent = run_reminders_loop(db)
                if sent:
                    log.info("reminders delivered: %s", sent)

                processed = run_pending_documents(db)
                if processed:
                    log.info("documents processed: %s", processed)

                embedded = embed_pending_sources(db)
                if embedded:
                    log.info("sources embedded: %s", embedded)

            if time.time() - last_cleanup > 6 * 3600:
                with session_scope() as db:
                    result = run_cleanup(db)
                log.info("cleanup: %s", result)
                last_cleanup = time.time()
        except Exception as exc:
            log.exception("scheduler cycle failed: %s", exc)
        time.sleep(30)


def main() -> None:
    redis_conn = Redis.from_url(settings.redis_url)
    queues = [
        Queue("documents", connection=redis_conn),
        Queue("ai", connection=redis_conn),
        Queue("default", connection=redis_conn),
    ]
    worker = Worker(queues, connection=redis_conn, name="beemuna-worker")

    import threading

    thread = threading.Thread(target=scheduler_loop, args=(redis_conn,), daemon=True)
    thread.start()
    log.info("beemuna worker running on queues: documents, ai, default")
    worker.work(with_scheduler=False)


if __name__ == "__main__":
    main()
