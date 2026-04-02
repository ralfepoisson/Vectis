from __future__ import annotations

from datetime import UTC, datetime

from fastapi import FastAPI
from fastapi.responses import PlainTextResponse

from agent.models import RuntimeState


def create_health_app(state: RuntimeState) -> FastAPI:
    app = FastAPI(title="Vectis Agent Health", docs_url=None, redoc_url=None)

    @app.get("/health")
    def health() -> dict[str, str | bool | None]:
        return {
            "status": "ok" if state.camera_connected else "degraded",
            "camera_connected": state.camera_connected,
            "backend_available": state.backend_available,
            "last_frame_received_at": state.last_frame_received_at.isoformat() if state.last_frame_received_at else None,
        }

    @app.get("/livez")
    def livez() -> dict[str, str]:
        return {"status": "alive"}

    @app.get("/readyz")
    def readyz() -> dict[str, str]:
        return {"status": "ready" if state.camera_connected and state.backend_available else "degraded"}

    @app.get("/metrics")
    def metrics() -> PlainTextResponse:
        uptime = (datetime.now(UTC) - state.started_at).total_seconds()
        last_frame = (
            (datetime.now(UTC) - state.last_frame_received_at).total_seconds()
            if state.last_frame_received_at
            else -1
        )
        return PlainTextResponse(
            "\n".join(
                [
                    f"vectis_agent_uptime_seconds {uptime}",
                    f"vectis_agent_camera_connected {1 if state.camera_connected else 0}",
                    f"vectis_agent_backend_available {1 if state.backend_available else 0}",
                    f"vectis_agent_pending_uploads {state.pending_uploads}",
                    f"vectis_agent_queue_size_bytes {state.queue_size_bytes}",
                    f"vectis_agent_recent_motion_trigger_count {state.recent_motion_trigger_count}",
                    f"vectis_agent_last_frame_age_seconds {last_frame}",
                ]
            )
        )
    return app
