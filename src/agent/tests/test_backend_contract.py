import json

import httpx

from agent.config.models import BackendSettings
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
            camera_id="camera-42",
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
