"""Detect local hardware specs for AI model recommendations."""

import logging
import platform
import shutil

import httpx

from app.core.config import settings
from app.ai.catalog import LOCAL_MODELS, ModelInfo, recommend_model

logger = logging.getLogger(__name__)


def detect_hardware() -> dict:
    """Detect system hardware for AI recommendations."""
    info: dict = {
        "os": platform.system(),
        "architecture": platform.machine(),
        "cpu_count": _get_cpu_count(),
        "ram_total_mb": 0,
        "ram_available_mb": 0,
        "disk_available_gb": 0,
        "ollama_installed": False,
        "ollama_version": None,
        "ollama_running": False,
        "installed_models": [],
        "gpu_available": False,
        "gpu_name": None,
        "gpu_vram_mb": 0,
    }

    try:
        import psutil
        mem = psutil.virtual_memory()
        info["ram_total_mb"] = mem.total // (1024 * 1024)
        info["ram_available_mb"] = mem.available // (1024 * 1024)
    except Exception:
        logger.warning("Could not detect RAM")

    try:
        usage = shutil.disk_usage("/")
        info["disk_available_gb"] = usage.free // (1024 * 1024 * 1024)
    except Exception:
        pass

    # Check Ollama
    _check_ollama(info)

    # Check GPU (best effort)
    _check_gpu(info)

    return info


def _get_cpu_count() -> int:
    try:
        import os
        return os.cpu_count() or 1
    except Exception:
        return 1


def _check_ollama(info: dict) -> None:
    try:
        with httpx.Client(timeout=5) as client:
            resp = client.get(f"{settings.ollama_url.rstrip('/')}/api/tags")
            if resp.status_code == 200:
                info["ollama_running"] = True
                info["ollama_installed"] = True
                data = resp.json()
                info["installed_models"] = [m.get("name", "") for m in data.get("models", [])]
    except Exception:
        pass

    # Try to get version
    try:
        import subprocess
        result = subprocess.run(["ollama", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            info["ollama_installed"] = True
            info["ollama_version"] = result.stdout.strip()
    except Exception:
        pass


def _check_gpu(info: dict) -> None:
    try:
        import subprocess
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            parts = result.stdout.strip().split(",")
            if len(parts) >= 2:
                info["gpu_available"] = True
                info["gpu_name"] = parts[0].strip()
                info["gpu_vram_mb"] = int(parts[1].strip())
    except Exception:
        pass


def get_recommendation(hardware: dict) -> dict:
    """Return a model recommendation based on hardware."""
    ram_mb = hardware.get("ram_total_mb", 0)
    model = recommend_model(ram_mb)

    return {
        "model": model,
        "reason": _get_recommendation_reason(hardware, model),
        "hardware_ready": True,
    }


def _get_recommendation_reason(hardware: dict, model: ModelInfo) -> str:
    ram_mb = hardware.get("ram_total_mb", 0)
    if ram_mb < 2000:
        return f"Your computer has limited resources. {model.friendly_name} ({model.friendly_size}) is recommended for the best experience."
    if ram_mb < 4000:
        return f"Your computer has moderate resources. {model.friendly_name} ({model.friendly_size}) is recommended."
    if ram_mb < 8000:
        return f"Your computer has good resources. {model.friendly_name} ({model.friendly_size}) is recommended."
    return f"Your computer has excellent resources. {model.friendly_name} ({model.friendly_size}) is recommended."
