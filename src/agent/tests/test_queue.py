from datetime import UTC, datetime, timedelta
from pathlib import Path

from agent.queue.sqlite_queue import QueueLimits, SqliteUploadQueue, UploadEnvelope


def test_queue_roundtrip_and_state_persistence(tmp_path: Path) -> None:
    queue = SqliteUploadQueue(tmp_path / "queue", QueueLimits(max_bytes=1024 * 1024, retention_hours=24))
    payload = b"preview-bytes"
    item = UploadEnvelope(
        endpoint="/ingest/preview-frame",
        content_type="image/jpeg",
        metadata={"device_id": "edge-1", "frame_type": "preview"},
        payload=payload,
    )

    queued = queue.enqueue(item)
    claim = queue.claim_next()

    assert claim is not None
    assert claim.id == queued.id
    assert claim.payload == payload

    queue.mark_succeeded(claim.id)

    reloaded = SqliteUploadQueue(tmp_path / "queue", QueueLimits(max_bytes=1024 * 1024, retention_hours=24))
    assert reloaded.pending_count() == 0


def test_queue_evicts_oldest_items_when_size_limit_exceeded(tmp_path: Path) -> None:
    queue = SqliteUploadQueue(tmp_path / "queue", QueueLimits(max_bytes=20, retention_hours=24))

    first = queue.enqueue(
        UploadEnvelope(
            endpoint="/ingest/preview-frame",
            content_type="image/jpeg",
            metadata={"sequence": 1},
            payload=b"1234567890",
        )
    )
    second = queue.enqueue(
        UploadEnvelope(
            endpoint="/ingest/preview-frame",
            content_type="image/jpeg",
            metadata={"sequence": 2},
            payload=b"abcdefghij",
        )
    )
    third = queue.enqueue(
        UploadEnvelope(
            endpoint="/ingest/preview-frame",
            content_type="image/jpeg",
            metadata={"sequence": 3},
            payload=b"klmnopqrst",
        )
    )

    assert first.id != second.id != third.id
    assert queue.pending_count() == 2
    ids = []
    while claim := queue.claim_next():
        ids.append(claim.id)
        queue.mark_succeeded(claim.id)
    assert first.id not in ids


def test_queue_prunes_expired_items(tmp_path: Path) -> None:
    queue = SqliteUploadQueue(tmp_path / "queue", QueueLimits(max_bytes=1024, retention_hours=1))
    queued = queue.enqueue(
        UploadEnvelope(
            endpoint="/ingest/preview-frame",
            content_type="image/jpeg",
            metadata={"sequence": 1},
            payload=b"1234",
        )
    )

    queue._connection.execute(
        "UPDATE uploads SET created_at = ? WHERE id = ?",
        ((datetime.now(UTC) - timedelta(hours=2)).isoformat(), queued.id),
    )
    queue._connection.commit()

    queue.prune()

    assert queue.pending_count() == 0
