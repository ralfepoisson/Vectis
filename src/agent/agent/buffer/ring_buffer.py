from __future__ import annotations

from collections import deque
from datetime import timedelta
from threading import Lock

from agent.models import FrameEnvelope


class FrameRingBuffer:
    def __init__(self, retention_seconds: float, max_frames: int) -> None:
        self._retention_seconds = retention_seconds
        self._frames: deque[FrameEnvelope] = deque(maxlen=max_frames)
        self._lock = Lock()

    def append(self, frame: FrameEnvelope) -> None:
        with self._lock:
            self._frames.append(frame)
            self._prune_locked()

    def snapshot(self) -> list[FrameEnvelope]:
        with self._lock:
            self._prune_locked()
            return list(self._frames)

    def _prune_locked(self) -> None:
        if not self._frames:
            return
        newest = self._frames[-1].timestamp_utc
        cutoff = newest - timedelta(seconds=self._retention_seconds)
        while self._frames and self._frames[0].timestamp_utc < cutoff:
            self._frames.popleft()
