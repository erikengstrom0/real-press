"""API Routers package."""

from .image import router as image_router
from .video import router as video_router
from .health import router as health_router

__all__ = ["image_router", "video_router", "health_router"]
