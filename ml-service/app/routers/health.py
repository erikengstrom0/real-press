"""
Health check endpoint.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter(tags=["health"])


class ModelInfo(BaseModel):
    """Information about a loaded model."""

    name: str
    loaded: bool
    device: str


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    models: List[ModelInfo]


# Global reference to detector (set by main.py)
_detector = None


def set_detector(detector):
    """Set the global detector reference."""
    global _detector
    _detector = detector


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Check service health and model status.

    Returns:
        Health status and information about loaded models
    """
    models = []

    if _detector is not None:
        models.append(
            ModelInfo(
                name=_detector.name,
                loaded=_detector.is_loaded(),
                device=str(_detector._device),
            )
        )

    status = "healthy" if all(m.loaded for m in models) else "degraded"

    return HealthResponse(status=status, models=models)
