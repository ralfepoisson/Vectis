from datetime import UTC, datetime, timedelta

import numpy as np

from agent.motion.detector import MotionDetector, MotionDetectorSettings
from agent.models import FrameEnvelope


def make_frame(value: int) -> np.ndarray:
    frame = np.zeros((64, 64, 3), dtype=np.uint8)
    frame[16:48, 16:48] = value
    return frame


def test_motion_detector_ignores_static_frames() -> None:
    detector = MotionDetector(
        MotionDetectorSettings(
            min_area=150,
            delta_threshold=20,
            blur_kernel_size=5,
            cooldown_seconds=0.0,
            min_motion_frames=2,
        )
    )
    timestamp = datetime.now(UTC)

    first = detector.evaluate(FrameEnvelope(frame=make_frame(0), timestamp_utc=timestamp, sequence_number=1))
    second = detector.evaluate(
        FrameEnvelope(frame=make_frame(0), timestamp_utc=timestamp + timedelta(milliseconds=100), sequence_number=2)
    )

    assert first is None
    assert second is None


def test_motion_detector_emits_trigger_for_large_change() -> None:
    detector = MotionDetector(
        MotionDetectorSettings(
            min_area=40,
            delta_threshold=10,
            blur_kernel_size=5,
            cooldown_seconds=0.0,
            min_motion_frames=1,
        )
    )
    timestamp = datetime.now(UTC)

    detector.evaluate(FrameEnvelope(frame=make_frame(0), timestamp_utc=timestamp, sequence_number=1))
    result = detector.evaluate(
        FrameEnvelope(frame=make_frame(255), timestamp_utc=timestamp + timedelta(milliseconds=100), sequence_number=2)
    )

    assert result is not None
    assert result.triggered is True
    assert result.motion_score > 0
    assert result.bounding_boxes
