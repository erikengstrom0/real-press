"""
Configuration for the ML service.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Model settings
    model_name: str = "cnn_detection"
    device: str = "cpu"  # 'cpu' or 'cuda'

    # Processing limits
    max_image_size_mb: float = 10.0
    max_video_duration_seconds: int = 300  # 5 minutes
    max_frames_per_video: int = 20

    # Timeouts
    download_timeout_seconds: int = 30
    inference_timeout_seconds: int = 60

    class Config:
        env_file = ".env"
        env_prefix = "ML_"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
