import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.rate_limit import RateLimitMiddleware


def test_rate_limit_lua_script_wired():
    mock_app = MagicMock()
    middleware = RateLimitMiddleware(mock_app, requests_per_window=5, window_seconds=60)

    mock_redis = MagicMock()
    mock_redis.ping.return_value = True
    mock_lua = MagicMock()
    mock_lua.return_value = [1, 0]
    mock_redis.register_script.return_value = mock_lua

    call_next = AsyncMock(return_value=MagicMock())
    request = MagicMock()
    request.method = "GET"
    request.url.path = "/api/v1/test"
    request.client.host = "127.0.0.1"

    with patch("app.core.rate_limit.redis.Redis.from_url", return_value=mock_redis):
        asyncio.run(middleware.dispatch(request, call_next))

    assert middleware._lua is not None
    mock_redis.register_script.assert_called_once()


def test_rate_limit_options_exempt():
    mock_app = MagicMock()
    middleware = RateLimitMiddleware(mock_app)

    call_next = AsyncMock()
    request = MagicMock()
    request.method = "OPTIONS"

    asyncio.run(middleware.dispatch(request, call_next))

    call_next.assert_called_once_with(request)


def test_rate_limit_fail_open_when_redis_down():
    mock_app = MagicMock()
    middleware = RateLimitMiddleware(mock_app)

    call_next = AsyncMock(return_value=MagicMock())
    request = MagicMock()
    request.method = "GET"
    request.url.path = "/api/v1/test"
    request.client.host = "127.0.0.1"

    with patch.object(middleware, "_client", return_value=None):
        asyncio.run(middleware.dispatch(request, call_next))

    call_next.assert_called_once_with(request)
