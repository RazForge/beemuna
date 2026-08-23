import time

import redis
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings

_LUA_SCRIPT = """
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local count = redis.call("INCR", key)
if count == 1 then
    redis.call("EXPIRE", key, window)
end
if count > limit then
    return {count, window}
end
return {count, 0}
"""


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-backed sliding-window rate limiting per IP + route."""

    def __init__(self, app, *, requests_per_window: int = 0, window_seconds: int = 0, exempt: set[str] | None = None):
        super().__init__(app)
        self.requests_per_window = requests_per_window or settings.rate_limit_requests
        self.window_seconds = window_seconds or settings.rate_limit_window_seconds
        self.exempt = exempt or set()
        self._redis: redis.Redis | None = None
        self._lua: str | None = None

    def _client(self) -> redis.Redis | None:
        if self._redis is None:
            try:
                self._redis = redis.Redis.from_url(settings.redis_url, socket_connect_timeout=1)
                self._redis.ping()
            except redis.RedisError:
                self._redis = None
        return self._redis

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)

        route = request.url.path
        if route in self.exempt or not request.client:
            return await call_next(request)

        client = self._client()
        if client is not None:
            try:
                if self._lua is None:
                    self._lua = client.register_script(_LUA_SCRIPT)
                now = int(time.time())
                window = now // self.window_seconds
                key = f"rl:{window}:{request.client.host}:{route}"
                count, retry = self._lua(keys=[key], args=[self.requests_per_window, self.window_seconds])
                if retry > 0:
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many requests. Please slow down."},
                        headers={"Retry-After": str(retry)},
                    )
            except redis.RedisError:
                pass

        return await call_next(request)
