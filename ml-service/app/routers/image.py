"""
Image detection endpoint.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import httpx
from PIL import Image
import io
import base64

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["image"])


class ImageDetectRequest(BaseModel):
    """Request body for image detection."""

    image_url: Optional[str] = Field(None, description="URL of the image to analyze")
    image_base64: Optional[str] = Field(
        None, description="Base64-encoded image data"
    )


class ImageDetectResponse(BaseModel):
    """Response from image detection."""

    score: float = Field(..., description="AI probability score (0=human, 1=AI)")
    confidence: float = Field(
        ..., description="Model confidence in the prediction (0-1)"
    )
    model: str = Field(..., description="Name of the model used")


# Global reference to detector (set by main.py)
_detector = None


def set_detector(detector):
    """Set the global detector reference."""
    global _detector
    _detector = detector


async def download_image(url: str) -> Image.Image:
    """Download an image from URL."""
    settings = get_settings()

    async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
        try:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download image: HTTP {e.response.status_code}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to download image: {str(e)}"
            )

        # Check content type
        content_type = response.headers.get("content-type", "")
        if not content_type.startswith("image/"):
            raise HTTPException(
                status_code=400, detail=f"URL does not point to an image: {content_type}"
            )

        # Check size
        content_length = int(response.headers.get("content-length", 0))
        max_size = int(settings.max_image_size_mb * 1024 * 1024)
        if content_length > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large: {content_length / 1024 / 1024:.1f}MB (max {settings.max_image_size_mb}MB)",
            )

        # Parse image
        try:
            image = Image.open(io.BytesIO(response.content))
            return image
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")


def decode_base64_image(data: str) -> Image.Image:
    """Decode a base64-encoded image."""
    try:
        # Handle data URL format
        if "," in data:
            data = data.split(",", 1)[1]

        image_data = base64.b64decode(data)
        return Image.open(io.BytesIO(image_data))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")


@router.post("/detect/image", response_model=ImageDetectResponse)
async def detect_image(request: ImageDetectRequest):
    """
    Detect if an image is AI-generated.

    Provide either image_url or image_base64 (not both).

    Returns:
        Detection result with AI probability score and confidence
    """
    if _detector is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Validate input
    if request.image_url and request.image_base64:
        raise HTTPException(
            status_code=400, detail="Provide either image_url or image_base64, not both"
        )

    if not request.image_url and not request.image_base64:
        raise HTTPException(
            status_code=400, detail="Must provide either image_url or image_base64"
        )

    # Load image
    if request.image_url:
        image = await download_image(request.image_url)
    else:
        image = decode_base64_image(request.image_base64)

    # Run detection
    try:
        result = _detector.detect(image)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")

    return ImageDetectResponse(
        score=result.score, confidence=result.confidence, model=result.model_name
    )
