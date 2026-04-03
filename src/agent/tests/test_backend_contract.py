import json

import httpx

from agent.config.models import BackendSettings
from agent.backend_client import BackendControlClient
from agent.transport.http import HttpUploader


def test_http_uploader_sends_backend_headers_and_json_payload() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["tenant"] = request.headers.get("x-tenant-id")
        captured["auth"] = request.headers.get("authorization")
        captured["content_type"] = request.headers.get("content-type")
        captured["body"] = request.content.decode("utf-8")
        return httpx.Response(202, json={"items": []})

    transport = httpx.MockTransport(handler)
    uploader = HttpUploader(
        BackendSettings(
            base_url="https://backend.example.com",
            tenant_id="tenant-42",
            agent_id="agent-42",
            auth_token="token-42",
        ),
        transport=transport,
    )

    uploader.post_json("/api/v1/agents/agent-42/frames", {"frames": []})

    assert captured["url"] == "https://backend.example.com/api/v1/agents/agent-42/frames"
    assert captured["tenant"] == "tenant-42"
    assert captured["auth"] == "Bearer token-42"
    assert str(captured["content_type"]).startswith("application/json")
    assert json.loads(str(captured["body"])) == {"frames": []}


def test_backend_control_client_parses_runtime_config() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://backend.example.com/api/v1/agents/agent-42/runtime-config"
        return httpx.Response(
            200,
            json={
                "runtimeConfig": {
                    "agent": {"id": "agent-42"},
                    "premises": {"id": "prem-42", "name": "Dock Site"},
                    "pollIntervalSeconds": 600,
                    "cameras": [
                        {
                            "id": "camera-42",
                            "name": "Yard Camera",
                            "streamUrl": "http://192.168.1.10:8080/stream",
                            "heartbeatUrl": "http://192.168.1.10:8080/heartbeat",
                            "ipAddress": "192.168.1.10",
                        }
                    ],
                }
            },
        )

    original_init = HttpUploader.__init__

    def patched_init(self: HttpUploader, settings: BackendSettings, transport: httpx.BaseTransport | None = None) -> None:
        original_init(self, settings, transport=httpx.MockTransport(handler))

    HttpUploader.__init__ = patched_init
    try:
        client = BackendControlClient(
            BackendSettings(
                base_url="https://backend.example.com",
                tenant_id="tenant-42",
                agent_id="agent-42",
                auth_token="token-42",
            )
        )
        runtime_config = client.fetch_runtime_config()
    finally:
        HttpUploader.__init__ = original_init

    assert runtime_config.agent_id == "agent-42"
    assert runtime_config.premises_id == "prem-42"
    assert runtime_config.poll_interval_seconds == 600
    assert runtime_config.cameras[0].id == "camera-42"
    assert runtime_config.cameras[0].stream_url == "http://192.168.1.10:8080/stream"
