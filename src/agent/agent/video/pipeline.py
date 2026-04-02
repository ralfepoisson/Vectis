from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
import base64
import json

import cv2
import numpy as np

from agent.buffer.ring_buffer import FrameRingBuffer
from agent.camera_service import CameraServiceClient, HeartbeatSnapshot
from agent.config.models import Settings
from agent.models import FrameEnvelope, RuntimeState, UploadTask
from agent.motion.detector import MotionDetector, MotionDetectorSettings
from agent.queue.sqlite_queue import QueueLimits, SqliteUploadQueue, UploadEnvelope
from agent.transport.base import UploadTransport
from agent.transport.http import HttpUploader


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MotionCaptureWindow:
    event_id: str
    started_at: datetime
    motion_score: float
    frames: list[FrameEnvelope]
    until_utc: datetime


def encode_jpeg(frame: np.ndarray, quality: int) -> bytes:
    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        raise RuntimeError("Failed to encode JPEG frame")
    return encoded.tobytes()


def resize_to_width(frame: np.ndarray, max_width: int) -> np.ndarray:
    height, width = frame.shape[:2]
    if width <= max_width:
        return frame
    scale = max_width / float(width)
    return cv2.resize(frame, (max_width, int(height * scale)))


class VideoGatewayAgent:
    def __init__(self, settings: Settings, state: RuntimeState) -> None:
        self.settings = settings
        self.state = state
        self._stop_event = threading.Event()
        self._ring_buffer = FrameRingBuffer(settings.buffer.retention_seconds, settings.buffer.max_frames)
        self._detector = MotionDetector(
            MotionDetectorSettings(
                min_area=settings.motion.min_area,
                delta_threshold=settings.motion.delta_threshold,
                blur_kernel_size=settings.motion.blur_kernel_size,
                cooldown_seconds=settings.motion.cooldown_seconds,
                min_motion_frames=settings.motion.min_motion_frames,
            )
        )
        self._queue = SqliteUploadQueue(
            settings.queue.path,
            QueueLimits(
                max_bytes=settings.queue.max_bytes,
                retention_hours=settings.queue.retention_hours,
                max_attempts=settings.queue.max_attempts,
            ),
        )
        self._uploader: UploadTransport = HttpUploader(settings.backend)
        self._camera_service = CameraServiceClient(
            settings.camera.heartbeat_url,
            timeout_seconds=settings.backend.timeout_seconds,
            verify_tls=settings.backend.verify_tls,
        )
        self._uploader_thread = threading.Thread(target=self._upload_loop, name="upload-loop", daemon=True)
        self._telemetry_thread = threading.Thread(target=self._telemetry_loop, name="telemetry-loop", daemon=True)
        self._active_capture: MotionCaptureWindow | None = None

    @property
    def queue(self) -> SqliteUploadQueue:
        return self._queue

    def start(self) -> None:
        self._uploader_thread.start()
        self._telemetry_thread.start()
        self._capture_loop()

    def stop(self) -> None:
        self._stop_event.set()
        self._camera_service.close()
        self._uploader.close()

    def _capture_loop(self) -> None:
        sequence_number = 0
        next_preview_due = time.monotonic()
        while not self._stop_event.is_set():
            capture = cv2.VideoCapture(self.settings.camera.stream_url)
            if not capture.isOpened():
                self.state.camera_connected = False
                self.state.last_camera_error = "Unable to open camera stream"
                logger.warning("Camera disconnected", extra={"device_id": self.settings.device_id})
                time.sleep(self.settings.camera.reconnect_delay_seconds)
                continue

            self.state.camera_connected = True
            self.state.last_camera_error = None
            logger.info("Camera connected", extra={"device_id": self.settings.device_id})

            try:
                while not self._stop_event.is_set():
                    ok, frame = capture.read()
                    if not ok or frame is None:
                        raise RuntimeError("Camera frame read failed")

                    timestamp = datetime.now(UTC)
                    sequence_number += 1
                    envelope = FrameEnvelope(frame=frame, timestamp_utc=timestamp, sequence_number=sequence_number)
                    self.state.last_frame_received_at = timestamp
                    self._ring_buffer.append(envelope)
                    self._handle_motion(envelope)

                    if time.monotonic() >= next_preview_due:
                        self._queue_preview(envelope)
                        next_preview_due = time.monotonic() + self.settings.preview.interval_seconds
            except Exception as exc:
                self.state.camera_connected = False
                self.state.last_camera_error = str(exc)
                logger.warning(
                    "Camera disconnected",
                    extra={"device_id": self.settings.device_id, "error": str(exc)},
                )
                time.sleep(self.settings.camera.reconnect_delay_seconds)
            finally:
                capture.release()

    def _queue_preview(self, envelope: FrameEnvelope) -> None:
        resized = resize_to_width(envelope.frame, self.settings.preview.max_width)
        payload = encode_jpeg(resized, self.settings.preview.jpeg_quality)
        metadata = {
            "device_id": self.settings.device_id,
            "timestamp_utc": envelope.timestamp_utc.isoformat(),
            "source_stream_id": self.settings.source_stream_id,
            "sequence_number": envelope.sequence_number,
            "frame_type": "preview",
        }
        self._queue_frame_batch(
            [self._build_backend_frame(envelope.timestamp_utc, payload)],
            metadata=metadata,
        )

    def _handle_motion(self, envelope: FrameEnvelope) -> None:
        if not self.settings.motion.enabled:
            return

        detection = self._detector.evaluate(envelope)
        if detection:
            event_id = str(uuid.uuid4())
            pre_trigger_frames = self._ring_buffer.snapshot()
            self._active_capture = MotionCaptureWindow(
                event_id=event_id,
                started_at=envelope.timestamp_utc,
                motion_score=detection.motion_score,
                frames=pre_trigger_frames,
                until_utc=envelope.timestamp_utc + timedelta(seconds=self.settings.motion.post_trigger_seconds),
            )
            self.state.recent_motion_trigger_count += 1
            logger.info(
                "Motion detected",
                extra={"device_id": self.settings.device_id, "event_id": event_id, "motion_score": detection.motion_score},
            )

        if self._active_capture is None:
            return

        self._active_capture.frames.append(envelope)
        if envelope.timestamp_utc >= self._active_capture.until_utc:
            self._finalize_motion_event(self._active_capture)
            self._active_capture = None

    def _finalize_motion_event(self, capture: MotionCaptureWindow) -> None:
        event_end = capture.frames[-1].timestamp_utc
        if self.settings.motion.upload_mode == "clip":
            logger.warning(
                "Backend only supports frame burst ingestion; falling back from clip mode to frames",
                extra={"device_id": self.settings.device_id, "event_id": capture.event_id},
            )
            payload, content_type = self._build_motion_frame_bundle(capture.frames)
            endpoint = f"/api/v1/agents/{self.settings.backend.agent_id}/frames"
            metadata = {
                "device_id": self.settings.device_id,
                "source_stream_id": self.settings.source_stream_id,
                "clip_type": "motion_event",
                "event_id": capture.event_id,
                "event_start_utc": capture.started_at.isoformat(),
                "event_end_utc": event_end.isoformat(),
                "motion_score": capture.motion_score,
            }
        else:
            payload, content_type = self._build_motion_frame_bundle(capture.frames)
            endpoint = f"/api/v1/agents/{self.settings.backend.agent_id}/frames"
            metadata = {
                "device_id": self.settings.device_id,
                "source_stream_id": self.settings.source_stream_id,
                "frame_type": "motion_event",
                "event_id": capture.event_id,
                "event_start_utc": capture.started_at.isoformat(),
                "event_end_utc": event_end.isoformat(),
                "motion_score": capture.motion_score,
            }

        self._queue.enqueue(
            UploadEnvelope(endpoint=endpoint, content_type=content_type, metadata=metadata, payload=payload)
        )
        logger.info(
            "Clip finalised",
            extra={"device_id": self.settings.device_id, "event_id": capture.event_id, "frame_count": len(capture.frames)},
        )

    def _build_motion_frame_bundle(self, frames: list[FrameEnvelope]) -> tuple[bytes, str]:
        encoded_frames: list[dict[str, str]] = []
        for envelope in frames:
            frame = resize_to_width(envelope.frame, self.settings.motion.clip_max_width)
            encoded = encode_jpeg(frame, self.settings.motion.jpeg_quality)
            encoded_frames.append(
                self._build_backend_frame(envelope.timestamp_utc, encoded)
            )

        return json.dumps({"frames": encoded_frames}).encode("utf-8"), "application/json"

    def _build_clip(self, frames: list[FrameEnvelope]) -> tuple[bytes, str]:
        temp_path = self.settings.queue.path / f"clip-{uuid.uuid4()}.mp4"
        first = resize_to_width(frames[0].frame, self.settings.motion.clip_max_width)
        height, width = first.shape[:2]
        writer = cv2.VideoWriter(
            str(temp_path),
            cv2.VideoWriter_fourcc(*"mp4v"),
            self.settings.motion.clip_fps,
            (width, height),
        )
        try:
            for envelope in frames:
                writer.write(resize_to_width(envelope.frame, self.settings.motion.clip_max_width))
        finally:
            writer.release()
        payload = temp_path.read_bytes()
        temp_path.unlink(missing_ok=True)
        return payload, "video/mp4"

    def _build_backend_frame(self, timestamp: datetime, jpeg_bytes: bytes) -> dict[str, str]:
        return {
            "cameraId": self.settings.backend.camera_id,
            "timestamp": timestamp.isoformat(),
            "contentType": "image/jpeg",
            "dataBase64": base64.b64encode(jpeg_bytes).decode("ascii"),
        }

    def _queue_frame_batch(self, frames: list[dict[str, str]], metadata: dict[str, str | float | int]) -> None:
        self._queue.enqueue(
            UploadEnvelope(
                endpoint=f"/api/v1/agents/{self.settings.backend.agent_id}/frames",
                content_type="application/json",
                metadata=metadata,
                payload=json.dumps({"frames": frames}).encode("utf-8"),
            )
        )

    def _upload_loop(self) -> None:
        delay = self.settings.backend.retry_initial_delay_seconds
        while not self._stop_event.is_set():
            self._queue.prune()
            self.state.pending_uploads = self._queue.pending_count()
            self.state.queue_size_bytes = self._queue.size_bytes()
            item = self._queue.claim_next()
            if item is None:
                time.sleep(0.5)
                continue
            try:
                self._uploader.upload(
                    UploadTask(
                        endpoint=item.endpoint,
                        content_type=item.content_type,
                        metadata=item.metadata,
                        payload=item.payload,
                    )
                )
                self._queue.mark_succeeded(item.id)
                self.state.backend_available = True
                self.state.last_backend_error = None
                delay = self.settings.backend.retry_initial_delay_seconds
                logger.info("Upload succeeded", extra={"device_id": self.settings.device_id, "endpoint": item.endpoint})
            except Exception as exc:
                self.state.backend_available = False
                self.state.last_backend_error = str(exc)
                retry_at = datetime.now(UTC) + timedelta(seconds=delay)
                self._queue.mark_failed(item.id, str(exc), retry_at=retry_at)
                logger.warning(
                    "Upload failed",
                    extra={"device_id": self.settings.device_id, "endpoint": item.endpoint, "error": str(exc)},
                )
                logger.info(
                    "Retry scheduled",
                    extra={"device_id": self.settings.device_id, "retry_at": retry_at.isoformat()},
                )
                delay = min(delay * 2, self.settings.backend.retry_max_delay_seconds)
                time.sleep(1.0)

    def _telemetry_loop(self) -> None:
        while not self._stop_event.is_set():
            self._queue_health_report()
            time.sleep(self.settings.telemetry.interval_seconds)

    def _queue_health_report(self) -> None:
        heartbeat: HeartbeatSnapshot | None = None
        try:
            heartbeat = self._camera_service.read_heartbeat()
        except Exception as exc:
            logger.warning("Failed to read Pi camera heartbeat", extra={"device_id": self.settings.device_id, "error": str(exc)})

        if not self.state.camera_connected:
            status = "offline"
        elif self.state.last_camera_error:
            status = "degraded"
        else:
            status = "online"

        payload = {
            "cameraId": self.settings.backend.camera_id,
            "status": status,
            "temperatureCelsius": heartbeat.temperature_celsius if heartbeat else None,
            "uptimeSeconds": heartbeat.uptime_seconds if heartbeat else int((datetime.now(UTC) - self.state.started_at).total_seconds()),
            "ipAddress": heartbeat.ip_addresses[0] if heartbeat and heartbeat.ip_addresses else None,
            "reportedAt": datetime.now(UTC).isoformat(),
        }
        self._queue.enqueue(
            UploadEnvelope(
                endpoint=f"/api/v1/agents/{self.settings.backend.agent_id}/camera-health",
                content_type="application/json",
                metadata={"device_id": self.settings.device_id, "camera_status": status},
                payload=json.dumps(payload).encode("utf-8"),
            )
        )
