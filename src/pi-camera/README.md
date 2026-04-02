# Vectis Pi Camera Service

This package runs on a Raspberry Pi 5 with Camera Module 3 and exposes a pullable HTTP video stream for the wider Vectis platform.

## Endpoints

- `GET /health`
  Returns stream metadata and service health.
- `GET /heartbeat`
  Returns the Pi heartbeat payload for the agent, including IP addresses, uptime, and device temperature.
- `GET /stream`
  Returns an MPEG-TS stream backed by `rpicam-vid`.

## Runtime

The service shells out to `rpicam-vid` using the `libav` backend and an `mpegts` container so another Vectis component can pull the feed over plain HTTP.

Default command:

```bash
rpicam-vid \
  --timeout 0 \
  --nopreview \
  --low-latency \
  --inline \
  --autofocus-mode continuous \
  --autofocus-range normal \
  --codec libav \
  --libav-format mpegts \
  --width 1920 \
  --height 1080 \
  --framerate 30 \
  --bitrate 4000000 \
  --output -
```

## Configuration

- `HOST`
- `PORT`
- `STREAM_PATH`
- `HEALTH_PATH`
- `RPICAM_BIN`
- `CAMERA_WIDTH`
- `CAMERA_HEIGHT`
- `CAMERA_FRAMERATE`
- `CAMERA_BITRATE`
- `CAMERA_LOW_LATENCY`
- `CAMERA_AUTOFOCUS_MODE`
- `CAMERA_AUTOFOCUS_RANGE`
- `CAMERA_LENS_POSITION`

## Focus Notes

The Raspberry Pi Camera Module 3 supports motorized focus. This service now defaults to `continuous` autofocus so the camera actively adjusts focus while streaming.

For fixed installations, you can switch to manual focus and lock a lens position:

```bash
CAMERA_AUTOFOCUS_MODE=manual
CAMERA_LENS_POSITION=0.5
```

## Local SSH Deployment

The repository includes a local deployment script for installing the Pi camera service onto a Raspberry Pi over SSH:

```bash
PI_HOST=192.168.1.22 PI_USER=ralfe ./scripts/deploy_pi_camera.sh
```

For non-interactive local testing with password authentication, set:

```bash
PI_PASSWORD=... PI_SUDO_PASSWORD=... PI_HOST=192.168.1.22 PI_USER=ralfe ./scripts/deploy_pi_camera.sh
```

The script:

1. builds the Pi camera package locally
2. ensures Node.js is installed on the Pi
3. uploads the built app over SSH
4. installs runtime dependencies on the Pi
5. installs a `systemd` service named `vectis-pi-camera`
6. restarts the service and checks the local health endpoint
