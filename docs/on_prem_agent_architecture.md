# On-Prem Agent Architecture

## Intent

The on-prem agent is the transport and buffering layer between the Raspberry Pi camera service and the Vectis backend. It is deliberately not an AI runtime. Its local decision is limited to whether additional media should be uploaded because motion occurred. Interpretation of that motion remains a backend concern.

## Runtime Shape

1. The Pi camera service exposes a standard local stream on the LAN.
2. On install, the agent is given its backend-generated `agentId`.
3. The agent calls the backend runtime-config endpoint to learn which premises it belongs to and which cameras it should handle.
4. A camera worker is started for each assigned camera stream and maintains an in-memory ring buffer.
5. A preview worker periodically extracts low-rate JPEGs for cloud-side situational awareness.
6. A deterministic motion detector evaluates each frame using frame differencing and contour thresholds.
7. When motion is triggered, the agent collects pre-trigger and post-trigger context, packages a burst of frames, and pushes it to the durable upload queue.
8. A retry worker drains the queue over outbound HTTPS while a config refresh loop re-checks backend configuration every 10 minutes.
9. A small local FastAPI service exposes health and metrics for operations.

## Edge Deployment

The Raspberry Pi camera service is deployed from the developer machine over SSH.

Current local deployment approach:

- build the `src/pi-camera` package locally
- copy the built runtime to the Pi over SSH
- install the service under `/opt/vectis/pi-camera`
- manage the runtime via a `systemd` unit named `vectis-pi-camera`

This keeps the edge deployment independent from the AWS cloud deployment path while the device remains reachable only on the home LAN.

## Why This First Version

- Outbound-only networking keeps deployment simple for customer premises.
- SQLite plus blob files is operationally straightforward and easy to inspect on a Pi.
- OpenCV provides one library for capture, resize, JPEG encoding, motion scoring, and optional clip generation.
- The package boundaries leave room to replace motion logic, queueing, upload transport, runtime config sync, or stream ingestion independently.

## Deferred Capabilities

- Remote configuration pull and config reconciliation
- Segment-based or hardware-assisted clip assembly
- End-to-end payload signing and stronger integrity guarantees
- More advanced liveness/readiness semantics tied to config freshness and backend acknowledgements
