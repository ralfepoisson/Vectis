from __future__ import annotations

from agent.config.models import BackendSettings
from agent.runtime_models import RuntimeCameraConfig, RuntimeConfig
from agent.transport.http import HttpUploader


class BackendControlClient:
    def __init__(self, settings: BackendSettings) -> None:
        self._settings = settings
        self._http = HttpUploader(settings)

    def fetch_runtime_config(self) -> RuntimeConfig:
        payload = self._http.get_json(f"/api/v1/agents/{self._settings.agent_id}/runtime-config")
        runtime = payload["runtimeConfig"]
        cameras = [
            RuntimeCameraConfig(
                id=item["id"],
                name=item["name"],
                stream_url=item["streamUrl"],
                heartbeat_url=item.get("heartbeatUrl"),
                ip_address=item.get("ipAddress"),
            )
            for item in runtime["cameras"]
        ]
        return RuntimeConfig(
            agent_id=runtime["agent"]["id"],
            premises_id=runtime["premises"]["id"],
            premises_name=runtime["premises"]["name"],
            poll_interval_seconds=float(runtime.get("pollIntervalSeconds", self._settings.config_refresh_seconds)),
            cameras=cameras,
        )

    def close(self) -> None:
        self._http.close()
