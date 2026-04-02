from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from agent.config.models import Settings


ENV_PREFIX = "VECTIS_AGENT__"


def _parse_env_value(raw_value: str) -> Any:
    lowered = raw_value.lower()
    if lowered in {"true", "false"}:
        return lowered == "true"
    try:
        if "." in raw_value:
            return float(raw_value)
        return int(raw_value)
    except ValueError:
        return raw_value


def _apply_nested_override(target: dict[str, Any], path: list[str], value: Any) -> None:
    cursor = target
    for part in path[:-1]:
        cursor = cursor.setdefault(part, {})
    cursor[path[-1]] = value


def load_settings(config_path: Path | str) -> Settings:
    path = Path(config_path)
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    for key, value in os.environ.items():
        if not key.startswith(ENV_PREFIX):
            continue
        parts = key.removeprefix(ENV_PREFIX).lower().split("__")
        _apply_nested_override(data, parts, _parse_env_value(value))
    try:
        settings = Settings.model_validate(data)
    except ValidationError:
        raise
    settings.queue.path = (path.parent / settings.queue.path).resolve() if not settings.queue.path.is_absolute() else settings.queue.path
    if settings.camera.source_stream_id:
        settings.source_stream_id = settings.camera.source_stream_id
    if settings.buffer.retention_seconds < settings.motion.pre_trigger_seconds:
        settings.buffer.retention_seconds = settings.motion.pre_trigger_seconds
    return settings

