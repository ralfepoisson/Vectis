from __future__ import annotations

import base64
import json
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

import cv2
import numpy as np

from agent.backend_client import BackendControlClient
from agent.buffer.ring_buffer import FrameRingBuffer
from agent.camera_service import CameraServiceClient, HeartbeatSnapshot
from agent.config.models import Settings
from agent.models import FrameEnvelope, RuntimeState, UploadTask
from agent.motion.detector import MotionDetector, MotionDetectorSettings
from agent.queue.sqlite_queue import QueueLimits, SqliteUploadQueue, UploadEnvelope
from agent.runtime_models import RuntimeCameraConfig, RuntimeConfig
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


@dataclass(slots=True)
class CameraWorkerState:
    camera_id: str
    camera_name: str
    stream_url: str
    heartbeat_url: str | None
    connected: bool = False
    last_frame_received_at: datetime | None = None
    last_error: str | None = None
    recent_motion_trigger_count: int = 0


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


class CameraWorker:
    def __init__(self, settings: Settings, camera: RuntimeCameraConfig, queue: SqliteUploadQueue) -> None:
        self._settings = settings
        self._camera = camera
        self._queue = queue
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._capture_loop, name=f"camera-{camera.id}", daemon=True)
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
        self._sequence_number = 0
        self._active_capture: MotionCaptureWindow | None = None
        self.state = CameraWorkerState(
            camera_id=camera.id,
            camera_name=camera.name,
            stream_url=camera.stream_url,
            heartbeat_url=camera.heartbeat_url,
        )

    @property
    def camera_id(self) -> str:
        return self._camera.id

    @property
    def signature(self) -> tuple[str, str | None]:
        return (self._camera.stream_url, self._camera.heartbeat_url)

    def start(self) -> None:
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread.is_alive():
            self._thread.join(timeout=5)

    def _capture_loop(self) -> None:
        next_preview_due = time.monotonic()
        while not self._stop_event.is_set():
            capture = cv2.VideoCapture(self._camera.stream_url)
            if not capture.isOpened():
                self.state.connected = False
                self.state.last_error = "Unable to open camera stream"
                logger.warning(
                    "Camera disconnected",
                    extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "stream_url": self._camera.stream_url},
                )
                time.sleep(self._settings.camera.reconnect_delay_seconds if self._settings.camera else 5.0)
                continue

            self.state.connected = True
            self.state.last_error = None
            logger.info(
                "Camera connected",
                extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "stream_url": self._camera.stream_url},
            )

            try:
                while not self._stop_event.is_set():
                    ok, frame = capture.read()
                    if not ok or frame is None:
                        raise RuntimeError("Camera frame read failed")

                    timestamp = datetime.now(UTC)
                    self._sequence_number += 1
                    envelope = FrameEnvelope(frame=frame, timestamp_utc=timestamp, sequence_number=self._sequence_number)
                    self.state.last_frame_received_at = timestamp
                    self._ring_buffer.append(envelope)
                    self._handle_motion(envelope)

                    if time.monotonic() >= next_preview_due:
                        self._queue_preview(envelope)
                        next_preview_due = time.monotonic() + self._settings.preview.interval_seconds
            except Exception as exc:
                self.state.connected = False
                self.state.last_error = str(exc)
                logger.warning(
                    "Camera disconnected",
                    extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "error": str(exc)},
                )
                time.sleep(self._settings.camera.reconnect_delay_seconds if self._settings.camera else 5.0)
            finally:
                capture.release()

    def _queue_preview(self, envelope: FrameEnvelope) -> None:
        resized = resize_to_width(envelope.frame, self._settings.preview.max_width)
        payload = self._build_backend_frames([self._frame_to_payload(envelope.timestamp_utc, resized, self._settings.preview.jpeg_quality)])
        metadata = {
            "device_id": self._settings.device_id,
            "camera_id": self._camera.id,
            "frame_type": "preview",
            "sequence_number": envelope.sequence_number,
        }
        self._queue.enqueue(
            UploadEnvelope(
                endpoint=f"/api/v1/agents/{self._settings.backend.agent_id}/frames",
                content_type="application/json",
                metadata=metadata,
                payload=payload,
            )
        )

    def _handle_motion(self, envelope: FrameEnvelope) -> None:
        if not self._settings.motion.enabled:
            return
        detection = self._detector.evaluate(envelope)
        if detection:
            event_id = str(uuid.uuid4())
            self._active_capture = MotionCaptureWindow(
                event_id=event_id,
                started_at=envelope.timestamp_utc,
                motion_score=detection.motion_score,
                frames=self._ring_buffer.snapshot(),
                until_utc=envelope.timestamp_utc + timedelta(seconds=self._settings.motion.post_trigger_seconds),
            )
            self.state.recent_motion_trigger_count += 1
            logger.info(
                "Motion detected",
                extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "event_id": event_id, "motion_score": detection.motion_score},
            )

        if self._active_capture is None:
            return

        self._active_capture.frames.append(envelope)
        if envelope.timestamp_utc >= self._active_capture.until_utc:
            self._finalize_motion_event(self._active_capture)
            self._active_capture = None

    def _finalize_motion_event(self, capture: MotionCaptureWindow) -> None:
        if self._settings.motion.upload_mode == "clip":
            logger.warning(
                "Backend only supports frame burst ingestion; falling back from clip mode to frames",
                extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "event_id": capture.event_id},
            )

        frames = []
        for envelope in capture.frames:
            frame = resize_to_width(envelope.frame, self._settings.motion.clip_max_width)
            frames.append(self._frame_to_payload(envelope.timestamp_utc, frame, self._settings.motion.jpeg_quality))
        payload = self._build_backend_frames(frames)
        metadata = {
            "device_id": self._settings.device_id,
            "camera_id": self._camera.id,
            "frame_type": "motion_event",
            "event_id": capture.event_id,
            "event_start_utc": capture.started_at.isoformat(),
            "event_end_utc": capture.frames[-1].timestamp_utc.isoformat(),
            "motion_score": capture.motion_score,
        }
        self._queue.enqueue(
            UploadEnvelope(
                endpoint=f"/api/v1/agents/{self._settings.backend.agent_id}/frames",
                content_type="application/json",
                metadata=metadata,
                payload=payload,
            )
        )
        logger.info(
            "Clip finalised",
            extra={"device_id": self._settings.device_id, "camera_id": self._camera.id, "event_id": capture.event_id, "frame_count": len(capture.frames)},
        )

    def _frame_to_payload(self, timestamp: datetime, frame: np.ndarray, quality: int) -> dict[str, str]:
        jpeg = encode_jpeg(frame, quality)
        return {
            "cameraId": self._camera.id,
            "timestamp": timestamp.isoformat(),
            "contentType": "image/jpeg",
            "dataBase64": base64.b64encode(jpeg).decode("ascii"),
        }

    def _build_backend_frames(self, frames: list[dict[str, str]]) -> bytes:
        return json.dumps({"frames": frames}).encode("utf-8")


class VideoGatewayAgent:
    def __init__(self, settings: Settings, state: RuntimeState) -> None:
        self.settings = settings
        self.state = state
        self._stop_event = threading.Event()
        self._queue = SqliteUploadQueue(
            settings.queue.path,
            QueueLimits(
                max_bytes=settings.queue.max_bytes,
                retention_hours=settings.queue.retention_hours,
                max_attempts=settings.queue.max_attempts,
            ),
        )
        self._uploader: UploadTransport = HttpUploader(settings.backend)
        self._control_client = BackendControlClient(settings.backend)
        self._workers: dict[str, CameraWorker] = {}
        self._runtime_config: RuntimeConfig | None = None
        self._config_lock = threading.Lock()
        self._uploader_thread = threading.Thread(target=self._upload_loop, name="upload-loop", daemon=True)
        self._health_thread = threading.Thread(target=self._health_loop, name="health-loop", daemon=True)
        self._config_thread = threading.Thread(target=self._config_loop, name="config-loop", daemon=True)

    @property
    def queue(self) -> SqliteUploadQueue:
        return self._queue

    def start(self) -> None:
        self._apply_runtime_config(self._fetch_runtime_config_with_retry())
        self._uploader_thread.start()
        self._health_thread.start()
        self._config_thread.start()
        while not self._stop_event.is_set():
            time.sleep(0.5)

    def stop(self) -> None:
        self._stop_event.set()
        for worker in list(self._workers.values()):
            worker.stop()
        self._workers.clear()
        self._control_client.close()
        self._uploader.close()

    def _fetch_runtime_config_with_retry(self) -> RuntimeConfig:
        delay = self.settings.backend.retry_initial_delay_seconds
        while not self._stop_event.is_set():
            try:
                runtime_config = self._control_client.fetch_runtime_config()
                self.state.backend_available = True
                self.state.last_backend_error = None
                return runtime_config
            except Exception as exc:
                self.state.backend_available = False
                self.state.last_backend_error = str(exc)
                logger.warning(
                    "Backend unavailable",
                    extra={"device_id": self.settings.device_id, "error": str(exc)},
                )
                time.sleep(delay)
                delay = min(delay * 2, self.settings.backend.retry_max_delay_seconds)
        raise RuntimeError("Agent stopped before runtime config could be fetched")

    def _config_loop(self) -> None:
        while not self._stop_event.is_set():
            interval = self._runtime_config.poll_interval_seconds if self._runtime_config else self.settings.backend.config_refresh_seconds
            time.sleep(interval)
            if self._stop_event.is_set():
                return
            try:
                self._apply_runtime_config(self._control_client.fetch_runtime_config())
                self.state.backend_available = True
                self.state.last_backend_error = None
            except Exception as exc:
                self.state.backend_available = False
                self.state.last_backend_error = str(exc)
                logger.warning(
                    "Runtime config refresh failed",
                    extra={"device_id": self.settings.device_id, "error": str(exc)},
                )

    def _apply_runtime_config(self, runtime_config: RuntimeConfig) -> None:
        with self._config_lock:
            self._runtime_config = runtime_config
            desired = {camera.id: camera for camera in runtime_config.cameras}
            for camera_id, worker in list(self._workers.items()):
                desired_camera = desired.get(camera_id)
                if desired_camera is None or worker.signature != (desired_camera.stream_url, desired_camera.heartbeat_url):
                    logger.info(
                        "Stopping camera worker",
                        extra={"device_id": self.settings.device_id, "camera_id": camera_id},
                    )
                    worker.stop()
                    del self._workers[camera_id]
            for camera in runtime_config.cameras:
                if camera.id in self._workers:
                    continue
                worker = CameraWorker(self.settings, camera, self._queue)
                self._workers[camera.id] = worker
                worker.start()
                logger.info(
                    "Starting camera worker",
                    extra={"device_id": self.settings.device_id, "camera_id": camera.id, "stream_url": camera.stream_url},
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

    def _health_loop(self) -> None:
        while not self._stop_event.is_set():
            workers = list(self._workers.values())
            self.state.camera_connected = any(worker.state.connected for worker in workers) if workers else False
            self.state.last_frame_received_at = max(
                (worker.state.last_frame_received_at for worker in workers if worker.state.last_frame_received_at),
                default=None,
            )
            self.state.recent_motion_trigger_count = sum(worker.state.recent_motion_trigger_count for worker in workers)
            for worker in workers:
                self._queue_health_report(worker)
            time.sleep(self.settings.telemetry.interval_seconds)

    def _queue_health_report(self, worker: CameraWorker) -> None:
        heartbeat: HeartbeatSnapshot | None = None
        try:
            camera_service = CameraServiceClient(
                worker.state.heartbeat_url,
                timeout_seconds=self.settings.backend.timeout_seconds,
                verify_tls=self.settings.backend.verify_tls,
            )
            heartbeat = camera_service.read_heartbeat()
            camera_service.close()
        except Exception as exc:
            logger.warning(
                "Failed to read Pi camera heartbeat",
                extra={"device_id": self.settings.device_id, "camera_id": worker.camera_id, "error": str(exc)},
            )

        if not worker.state.connected:
            status = "offline"
        elif worker.state.last_error:
            status = "degraded"
        else:
            status = "online"

        payload = {
            "cameraId": worker.camera_id,
            "status": status,
            "temperatureCelsius": heartbeat.temperature_celsius if heartbeat else None,
            "uptimeSeconds": heartbeat.uptime_seconds if heartbeat else None,
            "ipAddress": heartbeat.ip_addresses[0] if heartbeat and heartbeat.ip_addresses else None,
            "reportedAt": datetime.now(UTC).isoformat(),
        }
        self._queue.enqueue(
            UploadEnvelope(
                endpoint=f"/api/v1/agents/{self.settings.backend.agent_id}/camera-health",
                content_type="application/json",
                metadata={"device_id": self.settings.device_id, "camera_id": worker.camera_id, "camera_status": status},
                payload=json.dumps(payload).encode("utf-8"),
            )
        )
