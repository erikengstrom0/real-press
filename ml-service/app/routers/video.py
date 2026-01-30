"""
Video frame extraction endpoint.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import httpx
import tempfile
import os
import cv2
import base64

from ..config import get_settings

router = APIRouter(prefix="/api", tags=["video"])


class ExtractFramesRequest(BaseModel):
    """Request body for frame extraction."""

    video_url: str = Field(..., description="URL of the video to extract frames from")
    max_frames: int = Field(
        default=20, ge=1, le=60, description="Maximum number of frames to extract"
    )


class ExtractFramesResponse(BaseModel):
    """Response from frame extraction."""

    frame_base64: List[str] = Field(
        ..., description="Base64-encoded frame images (JPEG)"
    )
    fps: float = Field(..., description="Video frames per second")
    duration: float = Field(..., description="Video duration in seconds")
    total_frames: int = Field(..., description="Total frames in video")
    extracted_count: int = Field(..., description="Number of frames extracted")


async def download_video(url: str) -> str:
    """Download video to a temporary file."""
    settings = get_settings()

    async with httpx.AsyncClient(timeout=settings.download_timeout_seconds) as client:
        try:
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download video: HTTP {e.response.status_code}",
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to download video: {str(e)}"
            )

        # Write to temporary file
        suffix = ".mp4"  # Default extension
        content_type = response.headers.get("content-type", "")
        if "webm" in content_type:
            suffix = ".webm"
        elif "avi" in content_type:
            suffix = ".avi"
        elif "mov" in content_type or "quicktime" in content_type:
            suffix = ".mov"

        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        temp_file.write(response.content)
        temp_file.close()

        return temp_file.name


def extract_frames(video_path: str, max_frames: int) -> dict:
    """
    Extract frames from a video file at regular intervals.

    Args:
        video_path: Path to the video file
        max_frames: Maximum number of frames to extract

    Returns:
        Dict with frame data, fps, duration, and frame counts
    """
    settings = get_settings()

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not open video file")

    try:
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        # Check duration limit
        if duration > settings.max_video_duration_seconds:
            raise HTTPException(
                status_code=400,
                detail=f"Video too long: {duration:.1f}s (max {settings.max_video_duration_seconds}s)",
            )

        # Calculate frame interval for even sampling
        actual_max_frames = min(max_frames, settings.max_frames_per_video, total_frames)
        frame_interval = max(1, total_frames // actual_max_frames)

        frames_base64 = []
        frame_indices = []

        for i in range(0, total_frames, frame_interval):
            if len(frames_base64) >= actual_max_frames:
                break

            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()

            if not ret:
                continue

            # Convert BGR to RGB and encode as JPEG
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            _, buffer = cv2.imencode(".jpg", frame_rgb, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode("utf-8")

            frames_base64.append(frame_base64)
            frame_indices.append(i)

        return {
            "frame_base64": frames_base64,
            "fps": fps,
            "duration": duration,
            "total_frames": total_frames,
            "extracted_count": len(frames_base64),
        }

    finally:
        cap.release()


@router.post("/extract-frames", response_model=ExtractFramesResponse)
async def extract_video_frames(request: ExtractFramesRequest):
    """
    Extract frames from a video for AI detection analysis.

    Frames are extracted at regular intervals throughout the video.

    Returns:
        Base64-encoded frame images along with video metadata
    """
    video_path: Optional[str] = None

    try:
        # Download video
        video_path = await download_video(request.video_url)

        # Extract frames
        result = extract_frames(video_path, request.max_frames)

        return ExtractFramesResponse(**result)

    finally:
        # Clean up temporary file
        if video_path and os.path.exists(video_path):
            try:
                os.unlink(video_path)
            except Exception:
                pass
