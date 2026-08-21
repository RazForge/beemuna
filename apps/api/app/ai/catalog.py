"""BEMUNNA AI Model Catalog — friendly names for local and cloud models."""

from dataclasses import dataclass


@dataclass
class ModelInfo:
    internal_id: str
    friendly_name: str
    description: str
    badge: str
    ram_mb: int
    category: str  # "lite" | "balanced" | "smart" | "code" | "cloud"
    recommended_ram_mb: int = 0

    @property
    def friendly_size(self) -> str:
        if self.ram_mb < 1000:
            return f"~{self.ram_mb}MB"
        return f"~{self.ram_mb / 1000:.1f}GB"


LOCAL_MODELS: list[ModelInfo] = [
    # ── Ultra-Lite (under 500MB) ──
    ModelInfo(
        internal_id="qwen2.5:0.5b",
        friendly_name="BEMUNNA Lite",
        description="Very fast basic chat. Great for quick questions.",
        badge="Very Fast",
        ram_mb=400,
        category="lite",
        recommended_ram_mb=1000,
    ),

    # ── Balanced (500MB - 1.5GB) ──
    ModelInfo(
        internal_id="gemma3:1b",
        friendly_name="BEMUNNA Balanced",
        description="General chat with better quality. Great balance of speed and intelligence.",
        badge="Recommended",
        ram_mb=800,
        category="balanced",
        recommended_ram_mb=2000,
    ),
    ModelInfo(
        internal_id="qwen2.5:1.5b",
        friendly_name="BEMUNNA Quick",
        description="Fast everyday AI. Good for daily conversations.",
        badge="Fast",
        ram_mb=1000,
        category="balanced",
        recommended_ram_mb=3000,
    ),
    ModelInfo(
        internal_id="llama3.2:1b",
        friendly_name="BEMUNNA Smart",
        description="General conversations with solid understanding.",
        badge="Capable",
        ram_mb=1300,
        category="smart",
        recommended_ram_mb=4000,
    ),

    # ── Advanced (1.5GB - 3GB) ──
    ModelInfo(
        internal_id="qwen2.5-coder:3b",
        friendly_name="BEMUNNA Code",
        description="Designed specifically for programming and software development.",
        badge="Coding",
        ram_mb=1900,
        category="code",
        recommended_ram_mb=6000,
    ),
    ModelInfo(
        internal_id="qwen2.5:3b",
        friendly_name="BEMUNNA Plus",
        description="More detailed responses. Better for complex questions.",
        badge="Enhanced",
        ram_mb=2000,
        category="smart",
        recommended_ram_mb=6000,
    ),
]


CLOUD_MODELS: list[ModelInfo] = [
    ModelInfo(
        internal_id="meta/llama-3.1-8b-instruct",
        friendly_name="BEMUNNA Cloud",
        description="Powerful AI that works through the internet. No installation needed.",
        badge="Cloud",
        ram_mb=0,
        category="cloud",
    ),
    ModelInfo(
        internal_id="meta/llama-3.1-70b-instruct",
        friendly_name="BEMUNNA Cloud Pro",
        description="Our most powerful cloud model. Exceptional quality.",
        badge="Premium",
        ram_mb=0,
        category="cloud",
    ),
]


def get_model_by_internal_id(internal_id: str) -> ModelInfo | None:
    for m in LOCAL_MODELS + CLOUD_MODELS:
        if m.internal_id == internal_id:
            return m
    return None


def get_model_by_friendly_name(name: str) -> ModelInfo | None:
    for m in LOCAL_MODELS + CLOUD_MODELS:
        if m.friendly_name == name:
            return m
    return None


def recommend_model(available_ram_mb: int) -> ModelInfo:
    """Pick the best model for the user's RAM."""
    candidates = sorted(LOCAL_MODELS, key=lambda m: m.recommended_ram_mb, reverse=True)
    for model in candidates:
        if available_ram_mb >= model.recommended_ram_mb:
            return model
    return LOCAL_MODELS[0]  # fallback to Lite
