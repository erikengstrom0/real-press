"""
Base detector interface for AI-generated image detection.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from PIL import Image


@dataclass
class DetectionResult:
    """Result from image detection."""

    score: float  # 0.0 = human, 1.0 = AI
    confidence: float  # 0.0-1.0, how confident the model is
    model_name: str


class BaseDetector(ABC):
    """Abstract base class for image detectors."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Get the detector name."""
        pass

    @abstractmethod
    def load(self) -> None:
        """Load the model into memory."""
        pass

    @abstractmethod
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        pass

    @abstractmethod
    def detect(self, image: Image.Image) -> DetectionResult:
        """
        Detect if an image is AI-generated.

        Args:
            image: PIL Image to analyze

        Returns:
            DetectionResult with score and confidence
        """
        pass

    def unload(self) -> None:
        """Unload model from memory (optional)."""
        pass
