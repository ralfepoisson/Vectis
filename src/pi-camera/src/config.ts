export interface CameraServiceConfig {
  host: string;
  port: number;
  streamPath: string;
  healthPath: string;
  rpicamBinary: string;
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
  useLowLatency: boolean;
}

function readNumber(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return parsed;
}

function readPath(value: string | undefined, fallback: string): string {
  if (value === undefined) {
    return fallback;
  }

  return value.startsWith("/") ? value : `/${value}`;
}

export function readCameraServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): CameraServiceConfig {
  return {
    host: env.HOST ?? "0.0.0.0",
    port: readNumber(env.PORT, 8080, "PORT"),
    streamPath: readPath(env.STREAM_PATH, "/stream"),
    healthPath: readPath(env.HEALTH_PATH, "/health"),
    rpicamBinary: env.RPICAM_BIN ?? "rpicam-vid",
    width: readNumber(env.CAMERA_WIDTH, 1920, "CAMERA_WIDTH"),
    height: readNumber(env.CAMERA_HEIGHT, 1080, "CAMERA_HEIGHT"),
    framerate: readNumber(env.CAMERA_FRAMERATE, 30, "CAMERA_FRAMERATE"),
    bitrate: readNumber(env.CAMERA_BITRATE, 4_000_000, "CAMERA_BITRATE"),
    useLowLatency: env.CAMERA_LOW_LATENCY !== "false"
  };
}
