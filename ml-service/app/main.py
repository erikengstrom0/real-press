"""
ML Service - FastAPI Application

Provides AI-generated image/video detection endpoints.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .models import CNNDetector
from .routers import image_router, video_router, health_router
from .routers.image import set_detector as set_image_detector
from .routers.health import set_detector as set_health_detector


# Global detector instance
detector: CNNDetector | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan handler.
    Loads models on startup and cleans up on shutdown.
    """
    global detector

    settings = get_settings()

    # Load detector on startup
    print(f"Loading {settings.model_name} detector on {settings.device}...")
    detector = CNNDetector(device=settings.device)
    detector.load()
    print(f"Detector loaded successfully!")

    # Set global references in routers
    set_image_detector(detector)
    set_health_detector(detector)

    yield

    # Cleanup on shutdown
    if detector is not None:
        print("Unloading detector...")
        detector.unload()


# Create FastAPI app
app = FastAPI(
    title="Real Press ML Service",
    description="AI-generated content detection for images and videos",
    version="1.0.0",
    lifespan=lifespan,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(image_router)
app.include_router(video_router)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Real Press ML Service",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "detect_image": "POST /api/detect/image",
            "extract_frames": "POST /api/extract-frames",
        },
    }


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
