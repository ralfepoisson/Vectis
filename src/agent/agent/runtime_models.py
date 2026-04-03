from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RuntimeCameraConfig:
    id: str
    name: str
    stream_url: str
    heartbeat_url: str | None
    ip_address: str | None


@dataclass(slots=True)
class RuntimeConfig:
    agent_id: str
    premises_id: str
    premises_name: str
    poll_interval_seconds: float
    cameras: list[RuntimeCameraConfig]
