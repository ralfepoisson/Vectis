from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import cv2
import numpy as np

from agent.models import FrameEnvelope, MotionDetectionResult


@dataclass(slots=True)
class MotionDetectorSettings:
    min_area: int
    delta_threshold: int
    blur_kernel_size: int
    cooldown_seconds: float
    min_motion_frames: int


class MotionDetector:
    def __init__(self, settings: MotionDetectorSettings) -> None:
        self._settings = settings
        self._previous_gray: np.ndarray | None = None
        self._motion_streak = 0
        self._last_trigger_at = datetime.min.replace(tzinfo=UTC)

    def evaluate(self, envelope: FrameEnvelope) -> MotionDetectionResult | None:
        gray = cv2.cvtColor(envelope.frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (self._settings.blur_kernel_size, self._settings.blur_kernel_size), 0)

        if self._previous_gray is None:
            self._previous_gray = gray
            return None

        frame_delta = cv2.absdiff(self._previous_gray, gray)
        _, thresholded = cv2.threshold(frame_delta, self._settings.delta_threshold, 255, cv2.THRESH_BINARY)
        thresholded = cv2.dilate(thresholded, None, iterations=2)
        contours, _ = cv2.findContours(thresholded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        boxes: list[tuple[int, int, int, int]] = []
        total_area = 0.0
        for contour in contours:
            area = cv2.contourArea(contour)
            if area < self._settings.min_area:
                continue
            x, y, width, height = cv2.boundingRect(contour)
            boxes.append((x, y, width, height))
            total_area += area

        self._previous_gray = gray
        if not boxes:
            self._motion_streak = 0
            return None

        self._motion_streak += 1
        if self._motion_streak < self._settings.min_motion_frames:
            return None

        elapsed = (envelope.timestamp_utc - self._last_trigger_at).total_seconds()
        if elapsed < self._settings.cooldown_seconds:
            return None

        self._last_trigger_at = envelope.timestamp_utc
        self._motion_streak = 0
        return MotionDetectionResult(triggered=True, motion_score=float(total_area), bounding_boxes=boxes)

