from __future__ import annotations

import json
import logging
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import RLock
from typing import Any


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class QueueLimits:
    max_bytes: int
    retention_hours: int
    max_attempts: int = 20


@dataclass(slots=True)
class UploadEnvelope:
    endpoint: str
    content_type: str
    metadata: dict[str, Any]
    payload: bytes
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


class SqliteUploadQueue:
    def __init__(self, root_path: Path, limits: QueueLimits) -> None:
        self.root_path = root_path
        self.root_path.mkdir(parents=True, exist_ok=True)
        self.blob_path = self.root_path / "blobs"
        self.blob_path.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._limits = limits
        self._connection = sqlite3.connect(self.root_path / "queue.db", check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._initialize()

    def _initialize(self) -> None:
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                endpoint TEXT NOT NULL,
                content_type TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                payload_path TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                status TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                available_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                last_error TEXT
            )
            """
        )
        self._connection.commit()

    def enqueue(self, item: UploadEnvelope) -> UploadEnvelope:
        now = datetime.now(UTC).isoformat()
        payload_path = self.blob_path / f"{item.id}.bin"
        payload_path.write_bytes(item.payload)
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO uploads (
                    id, endpoint, content_type, metadata_json, payload_path, size_bytes,
                    status, attempts, available_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)
                """,
                (
                    item.id,
                    item.endpoint,
                    item.content_type,
                    json.dumps(item.metadata),
                    str(payload_path),
                    len(item.payload),
                    now,
                    now,
                    now,
                ),
            )
            self._connection.commit()
            self._prune_expired_locked()
            self._prune_oversized_locked()
            self._prune_exhausted_locked()
            self._connection.commit()
        return item

    def claim_next(self) -> UploadEnvelope | None:
        now = datetime.now(UTC).isoformat()
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM uploads
                WHERE status = 'pending' AND available_at <= ?
                ORDER BY created_at ASC
                LIMIT 1
                """,
                (now,),
            ).fetchone()
            if row is None:
                return None
            self._connection.execute(
                "UPDATE uploads SET status = 'in_progress', updated_at = ? WHERE id = ?",
                (now, row["id"]),
            )
            self._connection.commit()
        try:
            payload = Path(row["payload_path"]).read_bytes()
        except OSError as exc:
            logger.warning("Dropping corrupt queued upload", extra={"upload_id": row["id"], "error": str(exc)})
            self.mark_succeeded(row["id"])
            return None
        return UploadEnvelope(
            id=row["id"],
            endpoint=row["endpoint"],
            content_type=row["content_type"],
            metadata=json.loads(row["metadata_json"]),
            payload=payload,
        )

    def mark_succeeded(self, item_id: str) -> None:
        with self._lock:
            row = self._connection.execute("SELECT payload_path FROM uploads WHERE id = ?", (item_id,)).fetchone()
            self._connection.execute("DELETE FROM uploads WHERE id = ?", (item_id,))
            self._connection.commit()
        if row:
            Path(row["payload_path"]).unlink(missing_ok=True)

    def mark_failed(self, item_id: str, error: str, retry_at: datetime | None = None) -> None:
        available_at = (retry_at or datetime.now(UTC)).isoformat()
        with self._lock:
            self._connection.execute(
                """
                UPDATE uploads
                SET status = 'pending',
                    attempts = attempts + 1,
                    available_at = ?,
                    updated_at = ?,
                    last_error = ?
                WHERE id = ?
                """,
                (available_at, datetime.now(UTC).isoformat(), error, item_id),
            )
            self._connection.commit()

    def prune(self) -> None:
        with self._lock:
            self._prune_expired_locked()
            self._prune_oversized_locked()
            self._prune_exhausted_locked()
            self._connection.commit()

    def _prune_expired_locked(self) -> None:
        cutoff = datetime.now(UTC) - timedelta(hours=self._limits.retention_hours)
        rows = self._connection.execute(
            "SELECT id, payload_path FROM uploads WHERE created_at < ?",
            (cutoff.isoformat(),),
        ).fetchall()
        self._delete_rows(rows)

    def _prune_oversized_locked(self) -> None:
        while self.size_bytes() > self._limits.max_bytes:
            row = self._connection.execute(
                "SELECT id, payload_path FROM uploads ORDER BY created_at ASC LIMIT 1"
            ).fetchone()
            if row is None:
                break
            logger.warning("Dropping queued upload due to size limit", extra={"upload_id": row["id"]})
            self._delete_rows([row])

    def _prune_exhausted_locked(self) -> None:
        rows = self._connection.execute(
            "SELECT id, payload_path FROM uploads WHERE attempts >= ?",
            (self._limits.max_attempts,),
        ).fetchall()
        self._delete_rows(rows)

    def _delete_rows(self, rows: list[sqlite3.Row] | Any) -> None:
        for row in rows:
            self._connection.execute("DELETE FROM uploads WHERE id = ?", (row["id"],))
            Path(row["payload_path"]).unlink(missing_ok=True)

    def pending_count(self) -> int:
        row = self._connection.execute(
            "SELECT COUNT(*) AS count FROM uploads WHERE status IN ('pending', 'in_progress')"
        ).fetchone()
        return int(row["count"])

    def size_bytes(self) -> int:
        row = self._connection.execute("SELECT COALESCE(SUM(size_bytes), 0) AS total FROM uploads").fetchone()
        return int(row["total"])
