from __future__ import annotations

import argparse
import signal
import threading

import uvicorn

from agent.api.server import create_health_app
from agent.config.loader import load_settings
from agent.logging import configure_logging
from agent.models import RuntimeState
from agent.video.pipeline import VideoGatewayAgent


def main() -> None:
    parser = argparse.ArgumentParser(description="Vectis on-prem video gateway agent")
    parser.add_argument("--config", default="config/agent.example.yaml")
    args = parser.parse_args()

    settings = load_settings(args.config)
    configure_logging(settings.logging.level)
    state = RuntimeState()
    gateway = VideoGatewayAgent(settings, state)

    api_app = create_health_app(state)
    api_server = uvicorn.Server(
        uvicorn.Config(api_app, host=settings.api.host, port=settings.api.port, log_level="warning")
    )
    api_thread = threading.Thread(target=api_server.run, name="health-api", daemon=True)

    def handle_signal(signum: int, frame: object | None) -> None:
        gateway.stop()
        api_server.should_exit = True

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    api_thread.start()
    try:
        gateway.start()
    finally:
        gateway.stop()
        api_server.should_exit = True


if __name__ == "__main__":
    main()
