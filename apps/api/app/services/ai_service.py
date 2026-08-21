import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _ollama_body(model: str, messages: list[dict], temperature: float, stream: bool) -> dict:
    return {
        "model": model,
        "messages": messages,
        "stream": stream,
        "temperature": temperature,
        "keep_alive": settings.ollama_keep_alive,
        "options": {
            "temperature": temperature,
            "num_ctx": settings.ollama_num_ctx,
            "num_batch": settings.ollama_num_batch,
            "num_threads": settings.ollama_num_threads,
            "keep_alive": settings.ollama_keep_alive,
        },
    }


def _ollama_chat(model: str, messages: list[dict], temperature: float = 0.7, base_url: str | None = None) -> str:
    url = f"{(base_url or settings.ollama_url).rstrip('/')}/api/chat"
    with httpx.Client(timeout=180) as client:
        resp = client.post(url, json=_ollama_body(model, messages, temperature, stream=False))
        resp.raise_for_status()
        data = resp.json()
    return data.get("message", {}).get("content", "")


async def _ollama_chat_stream(model: str, messages: list[dict], temperature: float = 0.7, base_url: str | None = None):
    """Stream chat tokens from Ollama (NDJSON lines)."""
    url = f"{(base_url or settings.ollama_url).rstrip('/')}/api/chat"
    async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0)) as client:
        async with client.stream(
            "POST", url, json=_ollama_body(model, messages, temperature, stream=True)
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                delta = data.get("message", {}).get("content", "")
                if delta:
                    yield delta
                if data.get("done"):
                    return


async def _openai_chat_stream(model: str, messages: list[dict], temperature: float = 0.7,
                               base_url: str | None = None, api_key: str | None = None):
    """Stream chat tokens from OpenAI-compatible API."""
    import openai
    client = openai.AsyncOpenAI(
        api_key=api_key or settings.ai_api_key or settings.openai_api_key,
        base_url=base_url or settings.ai_base_url or None,
        timeout=httpx.Timeout(30.0, connect=5.0),
    )
    stream = await client.chat.completions.create(
        model=model, messages=messages, temperature=temperature, stream=True,
        max_tokens=1024,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content


def _openai_chat(
    model: str, messages: list[dict], temperature: float = 0.7,
    base_url: str | None = None, api_key: str | None = None,
) -> str:
    from openai import OpenAI
    client = OpenAI(
        api_key=api_key or settings.ai_api_key or settings.openai_api_key,
        base_url=base_url or settings.ai_base_url or None,
        timeout=httpx.Timeout(30.0, connect=5.0),
    )
    resp = client.chat.completions.create(
        model=model, messages=messages, temperature=temperature,
        max_tokens=1024,
    )
    return resp.choices[0].message.content or ""


def _anthropic_chat(model: str, messages: list[dict], temperature: float = 0.7) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ai_api_key)
    system = None
    converted: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
            continue
        converted.append({"role": m["role"], "content": m["content"]})
    resp = client.messages.create(
        model=model, system=system, messages=converted,
        max_tokens=2048, temperature=temperature,
    )
    return "".join(block.text or "" for block in resp.content if block.type == "text")


async def _anthropic_chat_stream(model: str, messages: list[dict], temperature: float = 0.7):
    """Stream from Anthropic API."""
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.ai_api_key)
    system = None
    converted: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
            continue
        converted.append({"role": m["role"], "content": m["content"]})
    async with client.messages.stream(
        model=model, system=system, messages=converted,
        max_tokens=2048, temperature=temperature,
    ) as stream:
        async for text in stream.text_stream:
            yield text


def _nvidia_chat(model: str, messages: list[dict], temperature: float = 0.7) -> str:
    """Chat via NVIDIA API (OpenAI-compatible)."""
    return _openai_chat(
        model, messages, temperature,
        base_url=settings.nvidia_base_url,
        api_key=settings.nvidia_api_key,
    )


async def _nvidia_chat_stream(model: str, messages: list[dict], temperature: float = 0.7):
    """Stream from NVIDIA API (OpenAI-compatible)."""
    async for chunk in _openai_chat_stream(
        model, messages, temperature,
        base_url=settings.nvidia_base_url,
        api_key=settings.nvidia_api_key,
    ):
        yield chunk


def chat_completion(
    messages: list[dict], provider: str | None = None,
    model: str | None = None, temperature: float = 0.7,
    base_url: str | None = None,
) -> str:
    provider = provider or settings.ai_provider
    model = model or settings.ai_model
    errors: list[str] = []

    candidates: list[tuple[str, str]] = []
    if provider == "anthropic":
        candidates = [("anthropic", model)]
    elif provider in ("gemini", "gemini-compatible"):
        candidates = [("gemini", model)]
    elif provider in ("openai", "openai-compatible"):
        candidates = [("openai", model)]
    elif provider == "nvidia":
        candidates = [("nvidia", model)]
    else:
        candidates = [("ollama", model)]

    fallback_model = settings.ai_model or "qwen2.5-coder:3b"
    if provider != "ollama":
        candidates.append(("ollama", fallback_model))
    if provider != "nvidia" and settings.nvidia_api_key:
        candidates.append(("nvidia", settings.nvidia_model))

    for prov, mdl in candidates:
        try:
            if prov == "ollama":
                return _ollama_chat(mdl, messages, temperature, base_url)
            if prov == "nvidia":
                return _nvidia_chat(mdl, messages, temperature)
            if prov == "anthropic":
                return _anthropic_chat(mdl, messages, temperature)
            if prov == "gemini":
                return _openai_chat(
                    mdl, messages, temperature,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai",
                )
            return _openai_chat(mdl, messages, temperature)
        except Exception as exc:
            errors.append(f"{prov}/{mdl}: {exc}")

    raise RuntimeError("AI providers unavailable: " + " | ".join(errors))


async def chat_completion_stream(
    messages: list[dict], provider: str | None = None,
    model: str | None = None, temperature: float = 0.7,
    base_url: str | None = None,
):
    """Yield answer tokens as they arrive. Supports true streaming for Ollama, OpenAI, and Anthropic."""
    provider = provider or settings.ai_provider
    model = model or settings.ai_model

    if provider == "ollama":
        try:
            async for chunk in _ollama_chat_stream(model, messages, temperature, base_url):
                yield chunk
            return
        except Exception as exc:
            logger.warning("Ollama streaming failed: %s", exc)

    if provider in ("openai", "openai-compatible", "gemini", "gemini-compatible"):
        try:
            _base = base_url
            if provider in ("gemini", "gemini-compatible"):
                _base = "https://generativelanguage.googleapis.com/v1beta/openai"
            async for chunk in _openai_chat_stream(model, messages, temperature, _base):
                yield chunk
            return
        except Exception as exc:
            logger.warning("OpenAI streaming failed: %s", exc)

    if provider == "nvidia":
        try:
            async for chunk in _nvidia_chat_stream(model, messages, temperature):
                yield chunk
            return
        except Exception as exc:
            logger.warning("NVIDIA streaming failed: %s", exc)

    if provider == "anthropic":
        try:
            async for chunk in _anthropic_chat_stream(model, messages, temperature):
                yield chunk
            return
        except Exception as exc:
            logger.warning("Anthropic streaming failed: %s", exc)

    # Fallback: one-shot with local model if cloud model was tried
    fallback_model = settings.ai_model or "qwen2.5-coder:3b"
    full = chat_completion(messages, "ollama", fallback_model, temperature)
    if full:
        yield full


def provider_status() -> dict[str, Any]:
    providers: dict[str, Any] = {
        "active_provider": settings.ai_provider,
        "model": settings.ai_model,
        "ollama_configured": bool(settings.ollama_url),
        "openai_configured": bool(settings.openai_api_key or settings.ai_api_key),
        "anthropic_configured": False,
        "gemini_configured": False,
        "nvidia_configured": bool(settings.nvidia_api_key),
    }
    if settings.ai_provider == "anthropic":
        providers["anthropic_configured"] = bool(settings.ai_api_key)
    if settings.ai_provider in ("gemini", "gemini-compatible"):
        providers["gemini_configured"] = bool(settings.ai_api_key)
    if settings.ai_provider == "nvidia":
        providers["nvidia_configured"] = bool(settings.nvidia_api_key)

    ollama_up = False
    try:
        with httpx.Client(timeout=3) as client:
            resp = client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            ollama_up = resp.status_code == 200
    except Exception:
        ollama_up = False
    providers["ollama_available"] = ollama_up
    return providers
