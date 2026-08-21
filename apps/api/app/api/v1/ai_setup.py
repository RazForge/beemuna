"""AI Setup Wizard routes — hardware detection, model install, cloud check."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as OrmSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.ai.catalog import LOCAL_MODELS, CLOUD_MODELS, get_model_by_internal_id
from app.services.hardware_service import detect_hardware, get_recommendation
from app.services import ollama_service

router = APIRouter(prefix="/ai/setup", tags=["ai-setup"])


class InstallModelIn(BaseModel):
    model_id: str


class ActivateModelIn(BaseModel):
    model_id: str
    mode: str  # "local" | "cloud"


# ── Hardware Detection ──

@router.get("/hardware")
def check_hardware(user: User = Depends(get_current_user)) -> dict:
    hw = detect_hardware()
    rec = get_recommendation(hw)
    return {
        "hardware": hw,
        "recommendation": {
            "model_id": rec["model"].internal_id,
            "friendly_name": rec["model"].friendly_name,
            "description": rec["model"].description,
            "badge": rec["model"].badge,
            "ram_mb": rec["model"].ram_mb,
            "reason": rec["reason"],
            "hardware_ready": rec["hardware_ready"],
        },
    }


# ── Model Catalog ──

@router.get("/catalog")
def get_catalog(user: User = Depends(get_current_user)) -> dict:
    hw = detect_hardware()
    installed = ollama_service.get_installed_models()

    local = []
    for m in LOCAL_MODELS:
        local.append({
            "internal_id": m.internal_id,
            "friendly_name": m.friendly_name,
            "description": m.description,
            "badge": m.badge,
            "ram_mb": m.ram_mb,
            "category": m.category,
            "size": m.friendly_size,
            "installed": m.internal_id in installed or f"{m.internal_id}:latest" in installed,
        })

    cloud = []
    for m in CLOUD_MODELS:
        cloud.append({
            "internal_id": m.internal_id,
            "friendly_name": m.friendly_name,
            "description": m.description,
            "badge": m.badge,
            "category": m.category,
            "available": bool(settings.nvidia_api_key),
        })

    return {
        "local_models": local,
        "cloud_models": cloud,
        "ollama_running": hw.get("ollama_running", False),
        "ollama_installed": hw.get("ollama_installed", False),
    }


# ── Model Installation ──

@router.post("/install")
def install_model(
    payload: InstallModelIn,
    user: User = Depends(get_current_user),
) -> dict:
    model = get_model_by_internal_id(payload.model_id)
    if not model:
        raise HTTPException(status_code=400, detail="Unknown model")

    # Check disk space
    hw = detect_hardware()
    if hw.get("disk_available_gb", 0) < 2:
        raise HTTPException(status_code=400, detail="Not enough disk space")

    result = ollama_service.install_model(payload.model_id)
    return result


@router.get("/install/status/{model_id}")
def check_install_status(
    model_id: str,
    user: User = Depends(get_current_user),
) -> dict:
    installed = ollama_service.check_model_installed(model_id)
    return {"model_id": model_id, "installed": installed}


# ── Model Activation ──

@router.post("/activate")
def activate_model(
    payload: ActivateModelIn,
    db: OrmSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    model = get_model_by_internal_id(payload.model_id)
    if not model:
        raise HTTPException(status_code=400, detail="Unknown model")

    if payload.mode == "local":
        user.ai_local_enabled = True
        user.ai_local_model = payload.model_id
        user.ai_cloud_model = None
    elif payload.mode == "cloud":
        user.ai_local_enabled = False
        user.ai_cloud_model = payload.model_id
        user.ai_local_model = None
    else:
        raise HTTPException(status_code=400, detail="Mode must be 'local' or 'cloud'")

    db.commit()
    return {"status": "activated", "model_id": payload.model_id, "mode": payload.mode}


# ── Ollama Status ──

@router.get("/ollama/status")
def ollama_status(user: User = Depends(get_current_user)) -> dict:
    return ollama_service.test_connection()


# ── Cloud Status ──

@router.get("/cloud/status")
def cloud_status(user: User = Depends(get_current_user)) -> dict:
    return {
        "nvidia_configured": bool(settings.nvidia_api_key),
        "model": settings.nvidia_model,
        "available": bool(settings.nvidia_api_key),
    }
