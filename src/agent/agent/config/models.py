from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field, SecretStr


class CameraSettings(BaseModel):
    stream_url: str
    heartbeat_url: str | None = None
    reconnect_delay_seconds: float = Field(default=5.0, ge=0.5)
    connect_timeout_seconds: float = Field(default=10.0, ge=1.0)
    source_stream_id: str | None = None


class PreviewSettings(BaseModel):
    interval_seconds: float = Field(default=2.0, ge=0.1)
    max_width: int = Field(default=640, ge=64)
    jpeg_quality: int = Field(default=75, ge=20, le=100)


class MotionSettings(BaseModel):
    enabled: bool = True
    min_area: int = Field(default=500, ge=1)
    delta_threshold: int = Field(default=25, ge=1)
    blur_kernel_size: int = Field(default=5, ge=3)
    min_motion_frames: int = Field(default=2, ge=1)
    cooldown_seconds: float = Field(default=3.0, ge=0.0)
    pre_trigger_seconds: float = Field(default=3.0, ge=0.0)
    post_trigger_seconds: float = Field(default=5.0, ge=0.1)
    upload_mode: str = Field(default="frames", pattern="^(frames|clip)$")
    clip_fps: float = Field(default=8.0, ge=1.0)
    clip_max_width: int = Field(default=960, ge=64)
    jpeg_quality: int = Field(default=80, ge=20, le=100)


class BufferSettings(BaseModel):
    retention_seconds: float = Field(default=10.0, ge=1.0)
    max_frames: int = Field(default=300, ge=1)


class BackendSettings(BaseModel):
    base_url: str
    tenant_id: str
    agent_id: str
    camera_id: str
    user_id: str | None = None
    auth_token: SecretStr | None = None
    api_key: SecretStr | None = None
    timeout_seconds: float = Field(default=20.0, ge=1.0)
    verify_tls: bool = True
    retry_initial_delay_seconds: float = Field(default=2.0, ge=0.1)
    retry_max_delay_seconds: float = Field(default=60.0, ge=1.0)


class QueueSettings(BaseModel):
    path: Path = Path("./data/queue")
    max_bytes: int = Field(default=512 * 1024 * 1024, ge=1024)
    retention_hours: int = Field(default=24, ge=1)
    max_attempts: int = Field(default=20, ge=1)


class TelemetrySettings(BaseModel):
    interval_seconds: float = Field(default=30.0, ge=5.0)


class HealthApiSettings(BaseModel):
    host: str = "0.0.0.0"
    port: int = Field(default=8080, ge=1, le=65535)


class LoggingSettings(BaseModel):
    level: str = Field(default="INFO")


class Settings(BaseModel):
    device_id: str
    source_stream_id: str = "camera-1"
    camera: CameraSettings
    preview: PreviewSettings = PreviewSettings()
    motion: MotionSettings = MotionSettings()
    buffer: BufferSettings = BufferSettings()
    backend: BackendSettings
    queue: QueueSettings = QueueSettings()
    telemetry: TelemetrySettings = TelemetrySettings()
    api: HealthApiSettings = HealthApiSettings()
    logging: LoggingSettings = LoggingSettings()
