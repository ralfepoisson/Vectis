from __future__ import annotations

import json
from pathlib import Path

import httpx

from agent.config.models import BackendSettings
from agent.models import UploadTask


class HttpUploader:
    def __init__(self, settings: BackendSettings, transport: httpx.BaseTransport | None = None) -> None:
        headers: dict[str, str] = {}
        headers["X-Tenant-Id"] = settings.tenant_id
        if settings.user_id:
            headers["X-User-Id"] = settings.user_id
        if settings.auth_token:
            headers["Authorization"] = f"Bearer {settings.auth_token.get_secret_value()}"
        elif settings.api_key:
            headers["X-API-Key"] = settings.api_key.get_secret_value()
        self._client = httpx.Client(
            base_url=settings.base_url.rstrip("/"),
            timeout=settings.timeout_seconds,
            verify=settings.verify_tls,
            headers=headers,
            transport=transport,
        )

    def upload(self, task: UploadTask) -> None:
        payload = task.payload if task.payload is not None else Path(task.payload_path or "").read_bytes()
        headers = {"Content-Type": task.content_type}
        response = self._client.post(task.endpoint, content=payload, headers=headers)
        response.raise_for_status()

    def post_json(self, endpoint: str, payload: dict[str, object]) -> None:
        response = self._client.post(endpoint, json=payload)
        response.raise_for_status()

    def get_json(self, endpoint: str) -> dict[str, object]:
        response = self._client.get(endpoint)
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        self._client.close()
