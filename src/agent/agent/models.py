from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np


def utc_now() -> datetime:
    return datetime.now(UTC)


@dataclass(slots=True)
class FrameEnvelope:
    frame: np.ndarray
    timestamp_utc: datetime
    sequence_number: int


@dataclass(slots=True)
class MotionDetectionResult:
    triggered: bool
    motion_score: float
    bounding_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)


@dataclass(slots=True)
class RuntimeState:
    started_at: datetime = field(default_factory=utc_now)
    camera_connected: bool = False
    last_frame_received_at: datetime | None = None
    last_camera_error: str | None = None
    backend_available: bool = True
    last_backend_error: str | None = None
    pending_uploads: int = 0
    queue_size_bytes: int = 0
    recent_motion_trigger_count: int = 0


@dataclass(slots=True)
class UploadTask:
    endpoint: str
    content_type: str
    metadata: dict[str, Any]
    payload: bytes | None = None
    payload_path: Path | None = None

