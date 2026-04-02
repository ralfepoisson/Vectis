import type { CameraServiceConfig } from "./config";

export interface PiCameraServiceUnitOptions {
  serviceName: string;
  description?: string;
  installDir: string;
  environmentFilePath: string;
  user: string;
  group: string;
  nodeBinary?: string;
}

export function renderPiCameraEnvironmentFile(config: CameraServiceConfig): string {
  return [
    `HOST=${config.host}`,
    `PORT=${config.port}`,
    `STREAM_PATH=${config.streamPath}`,
    `HEALTH_PATH=${config.healthPath}`,
    `RPICAM_BIN=${config.rpicamBinary}`,
    `CAMERA_WIDTH=${config.width}`,
    `CAMERA_HEIGHT=${config.height}`,
    `CAMERA_FRAMERATE=${config.framerate}`,
    `CAMERA_BITRATE=${config.bitrate}`,
    `CAMERA_LOW_LATENCY=${String(config.useLowLatency)}`
  ].join("\n");
}

export function renderPiCameraSystemdUnit(options: PiCameraServiceUnitOptions): string {
  const nodeBinary = options.nodeBinary ?? "/usr/bin/node";
  const description = options.description ?? "Vectis Pi Camera Service";

  return [
    "[Unit]",
    `Description=${description}`,
    "After=network.target",
    "",
    "[Service]",
    "Type=simple",
    `User=${options.user}`,
    `Group=${options.group}`,
    `WorkingDirectory=${options.installDir}`,
    `EnvironmentFile=${options.environmentFilePath}`,
    `ExecStart=${nodeBinary} ${options.installDir}/dist/server.js`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    "WantedBy=multi-user.target"
  ].join("\n");
}
