from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

import httpx


@dataclass(slots=True)
class HeartbeatSnapshot:
    ip_addresses: list[str]
    uptime_seconds: int | None
    temperature_celsius: float | None


class CameraServiceClient:
    def __init__(self, heartbeat_url: str | None, timeout_seconds: float, verify_tls: bool) -> None:
        self._heartbeat_url = heartbeat_url
        self._client = httpx.Client(timeout=timeout_seconds, verify=verify_tls)

    def read_heartbeat(self) -> HeartbeatSnapshot | None:
        if not self._heartbeat_url:
            return None
        response = self._client.get(self._heartbeat_url)
        response.raise_for_status()
        payload = response.json()
        return HeartbeatSnapshot(
            ip_addresses=list(payload.get("ipAddresses", [])),
            uptime_seconds=payload.get("uptimeSeconds"),
            temperature_celsius=payload.get("temperatureCelsius"),
        )

    def close(self) -> None:
        self._client.close()
