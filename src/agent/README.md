# Vectis On-Prem Video Gateway Agent

## Architecture Summary

This agent runs on the customer premises beside the Raspberry Pi camera service. In the current Vectis repo, that Pi service exposes an HTTP MPEG-TS stream on `/stream` and heartbeat data on `/heartbeat`, so the agent is implemented to consume those interfaces directly. It keeps a short ring buffer, emits low-rate preview frames continuously, and uses deterministic frame differencing to decide when to upload additional context for a motion event. The agent never runs AI inference locally. It only performs lightweight transport optimization and sends media plus telemetry to the cloud over outbound HTTPS.

The runtime is split into a few replaceable parts:

- `video`: camera ingest, reconnect handling, preview extraction, and motion-event capture windows
- `motion`: deterministic motion scoring using OpenCV frame differencing
- `buffer`: rolling in-memory frame retention for pre-trigger context
- `queue`: disk-backed SQLite queue with payload blobs, retry scheduling, retention, and size enforcement
- `transport`: outbound REST upload client
- `api`: local health and metrics endpoints

## Recommended Project Structure

```text
src/agent/
├── agent/
│   ├── api/
│   ├── buffer/
│   ├── config/
│   ├── motion/
│   ├── queue/
│   ├── telemetry/
│   ├── transport/
│   ├── video/
│   ├── logging.py
│   ├── main.py
│   └── models.py
├── config/
│   └── agent.example.yaml
├── tests/
├── Dockerfile
├── pyproject.toml
└── README.md
```

## Responsibilities

- Consume a local camera stream from the Pi camera service
- Read heartbeat data from the Pi camera service when available
- Produce low-rate preview JPEGs with device and stream metadata
- Detect motion without classifying it
- Preserve pre-trigger context and upload either motion frame bursts or a short clip
- Keep buffering and retrying while the backend is unavailable
- Emit operational telemetry to the backend
- Expose `/health`, `/livez`, `/readyz`, and `/metrics` locally

## Setup On Raspberry Pi OS

1. Install system packages:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip libopencv-dev
```

2. Create a virtual environment and install the agent:

```bash
cd /path/to/Vectis/src/agent
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
```

3. Copy and edit the sample config:

```bash
cp config/agent.example.yaml config/agent.local.yaml
```

4. Run the agent:

```bash
. .venv/bin/activate
vectis-agent --config config/agent.local.yaml
```

## Environment Overrides

Any config value can be overridden with `VECTIS_AGENT__...` environment variables. Examples:

```bash
export VECTIS_AGENT__BACKEND__AUTH_TOKEN="secret-token"
export VECTIS_AGENT__PREVIEW__INTERVAL_SECONDS=1
```

## Local Development

Run the tests:

```bash
. .venv/bin/activate
pytest -q
```

Run the health API and pipeline together:

```bash
. .venv/bin/activate
vectis-agent --config config/agent.example.yaml
```

## Interface Alignment

The implementation is aligned to the current repository interfaces:

- Pi camera service:
  - `GET /stream` returns `video/mp2t` MPEG-TS over HTTP
  - `GET /heartbeat` returns `ipAddresses`, `uptimeSeconds`, and `temperatureCelsius`
- Backend ingest:
  - `POST /api/v1/agents/{agentId}/camera-health`
  - `POST /api/v1/agents/{agentId}/frames`
  - requests require tenant context through `x-tenant-id` or a bearer token with tenant claims

## Backend Payloads

Preview and motion uploads are sent to the backend as JSON in the documented `IngestFramesRequest` shape:

```json
{
  "frames": [
    {
      "cameraId": "camera-demo",
      "timestamp": "2026-04-02T10:15:00.000Z",
      "contentType": "image/jpeg",
      "dataBase64": "..."
    }
  ]
}
```

Camera health uploads are sent in the documented `CreateCameraHealthReportRequest` shape:

```json
{
  "cameraId": "camera-demo",
  "status": "online",
  "temperatureCelsius": 58.1,
  "uptimeSeconds": 7200,
  "ipAddress": "192.168.1.50",
  "reportedAt": "2026-04-02T10:15:00.000Z"
}
```

## Tests Included

- Motion detection logic
- Disk-backed queue persistence, eviction, and retention
- YAML config loading with environment variable overrides

## Assumptions And Limitations

- The first version uses OpenCV `VideoCapture`, which is simple and portable but not the most efficient HTTP MPEG-TS ingestion path for every Pi deployment.
- The current backend contract only persists frames, not clips or event metadata, so motion uploads are sent as JPEG frame batches even when the local configuration asks for clip mode.
- The ring buffer is in memory; the durable queue starts after media selection, not before frame capture.
- Camera health telemetry is queued like other outbound traffic, so backend health status can lag while the backend is down.
- No remote configuration pull channel is implemented yet; the agent is structured so a config-sync worker can be added later without rewriting the capture pipeline.

## Next Steps

- Add a backend-driven remote configuration sync loop over outbound HTTPS
- Swap OpenCV ingestion for an FFmpeg/GStreamer adapter when lower CPU usage becomes important
- Add signed upload envelopes, payload checksums, and queue compaction metrics
- Add segment-based buffering to reduce memory pressure for higher resolution streams
- Add integration tests against a mock ingest API and a sample RTSP source
