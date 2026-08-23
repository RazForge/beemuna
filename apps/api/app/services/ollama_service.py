"""Manage Ollama — install models, check status."""

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def install_model(model_id: str) -> dict:
    """Pull an Ollama model. Returns status dict."""
    url = f"{settings.ollama_url.rstrip('/')}/api/pull"
    try:
        with httpx.Client(timeout=600) as client:
            resp = client.post(url, json={"name": model_id, "stream": False})
            resp.raise_for_status()
            return {"status": "success", "model": model_id}
    except httpx.HTTPStatusError as e:
        return {"status": "error", "error": f"HTTP {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:300]}


def check_model_installed(model_id: str) -> bool:
    """Check if a model is installed locally."""
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                models = resp.json().get("models", [])
                installed_ids = [m.get("name", "") for m in models]
                # Ollama uses "model:tag" format, check both exact and with :latest
                return model_id in installed_ids or f"{model_id}:latest" in installed_ids
    except Exception:
        pass
    return False


def get_installed_models() -> list[str]:
    """Return list of installed model IDs."""
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                return [m.get("name", "") for m in resp.json().get("models", [])]
    except Exception:
        pass
    return []


def delete_model(model_id: str) -> dict:
    """Delete a model from Ollama."""
    url = f"{settings.ollama_url.rstrip('/')}/api/delete"
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.request("DELETE", url, json={"name": model_id})
            resp.raise_for_status()
            return {"status": "success"}
    except Exception as e:
        return {"status": "error", "error": str(e)[:300]}


def test_connection() -> dict:
    """Test Ollama connection."""
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                return {"connected": True, "models_count": len(resp.json().get("models", []))}
    except Exception:
        pass
    return {"connected": False, "models_count": 0}
