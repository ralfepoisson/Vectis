from __future__ import annotations

from typing import Protocol

from agent.models import UploadTask


class UploadTransport(Protocol):
    def upload(self, task: UploadTask) -> None: ...

    def close(self) -> None: ...
