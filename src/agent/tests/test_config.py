from pathlib import Path

from agent.config.loader import load_settings


def test_load_settings_from_yaml_and_env_override(tmp_path: Path, monkeypatch) -> None:
    config_path = tmp_path / "agent.yaml"
    config_path.write_text(
        """
device_id: edge-001
source_stream_id: lobby-main
preview:
  interval_seconds: 5
backend:
  base_url: https://backend.example.com
  tenant_id: tenant-001
  agent_id: agent-001
  auth_token: yaml-token
queue:
  path: ./tmp-queue
""".strip(),
        encoding="utf-8",
    )

    monkeypatch.setenv("VECTIS_AGENT__PREVIEW__INTERVAL_SECONDS", "2")
    monkeypatch.setenv("VECTIS_AGENT__BACKEND__AUTH_TOKEN", "env-token")

    settings = load_settings(config_path)

    assert settings.device_id == "edge-001"
    assert settings.camera is None
    assert settings.preview.interval_seconds == 2
    assert settings.backend.tenant_id == "tenant-001"
    assert settings.backend.agent_id == "agent-001"
    assert settings.backend.auth_token.get_secret_value() == "env-token"
    assert settings.queue.path == (config_path.parent / "tmp-queue").resolve()


def test_load_settings_requires_minimum_fields(tmp_path: Path) -> None:
    config_path = tmp_path / "bad.yaml"
    config_path.write_text("device_id: missing-camera\n", encoding="utf-8")

    try:
        load_settings(config_path)
    except Exception as exc:  # pragma: no cover - exact type set by implementation
        assert "backend" in str(exc).lower()
    else:  # pragma: no cover
        raise AssertionError("Expected invalid configuration to raise")
