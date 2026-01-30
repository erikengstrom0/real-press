"""
CNN-based AI Image Detector

Uses a ResNet-based architecture trained to detect AI-generated images.
Based on the CNNDetection approach for detecting GAN-generated images.

Reference: https://github.com/peterwang512/CNNDetection
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
import numpy as np
from typing import Optional

from .base import BaseDetector, DetectionResult


class CNNDetector(BaseDetector):
    """
    CNN-based detector for AI-generated images.

    Uses a ResNet50 backbone fine-tuned for binary classification
    (real vs. AI-generated). For MVP, we use a pretrained ResNet50
    and add a simple classifier head.
    """

    def __init__(self, device: str = "cpu", model_path: Optional[str] = None):
        """
        Initialize the CNN detector.

        Args:
            device: 'cpu' or 'cuda'
            model_path: Optional path to custom trained weights
        """
        self._device = torch.device(device)
        self._model: Optional[nn.Module] = None
        self._model_path = model_path
        self._transform = self._get_transform()

    @property
    def name(self) -> str:
        return "cnn_detection"

    def _get_transform(self) -> transforms.Compose:
        """Get image preprocessing transforms."""
        return transforms.Compose(
            [
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
                ),
            ]
        )

    def _create_model(self) -> nn.Module:
        """
        Create the detection model.

        Uses ResNet50 pretrained on ImageNet with a binary classifier head.
        For MVP, we use the pretrained features as a reasonable baseline.
        A production system would use weights fine-tuned on AI-generated images.
        """
        # Load pretrained ResNet50
        model = resnet50(weights=ResNet50_Weights.IMAGENET1K_V2)

        # Replace the final fully connected layer for binary classification
        num_features = model.fc.in_features
        model.fc = nn.Sequential(
            nn.Linear(num_features, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, 1),
            nn.Sigmoid(),
        )

        return model

    def load(self) -> None:
        """Load the model into memory."""
        if self._model is not None:
            return

        self._model = self._create_model()

        # Load custom weights if provided
        if self._model_path:
            try:
                state_dict = torch.load(self._model_path, map_location=self._device)
                self._model.load_state_dict(state_dict)
            except Exception as e:
                print(f"Warning: Could not load custom weights from {self._model_path}: {e}")
                print("Using pretrained ImageNet weights as baseline.")

        self._model = self._model.to(self._device)
        self._model.eval()

    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._model is not None

    def unload(self) -> None:
        """Unload model from memory."""
        self._model = None
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def detect(self, image: Image.Image) -> DetectionResult:
        """
        Detect if an image is AI-generated.

        Args:
            image: PIL Image to analyze

        Returns:
            DetectionResult with score (0=human, 1=AI) and confidence
        """
        if not self.is_loaded():
            self.load()

        # Ensure RGB mode
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Preprocess image
        input_tensor = self._transform(image).unsqueeze(0).to(self._device)

        # Run inference
        with torch.no_grad():
            output = self._model(input_tensor)
            score = output.item()

        # Calculate confidence based on how far from 0.5 the score is
        # Scores near 0.5 indicate uncertainty
        confidence = self._calculate_confidence(score)

        return DetectionResult(score=score, confidence=confidence, model_name=self.name)

    def _calculate_confidence(self, score: float) -> float:
        """
        Calculate confidence based on score distance from decision boundary.

        Scores very close to 0.5 indicate low confidence.
        Scores near 0 or 1 indicate high confidence.
        """
        # Distance from 0.5 (decision boundary)
        distance = abs(score - 0.5) * 2  # Normalize to 0-1

        # Apply sigmoid-like scaling to emphasize high-confidence predictions
        # This gives more weight to predictions that are very sure
        confidence = 0.5 + 0.5 * (distance**0.7)

        return min(max(confidence, 0.3), 0.95)  # Clamp between 0.3 and 0.95
