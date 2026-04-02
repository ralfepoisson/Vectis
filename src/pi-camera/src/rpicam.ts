import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough, type Readable } from "node:stream";

import type { CameraServiceConfig } from "./config.js";

export interface SpawnedCameraProcess extends EventEmitter {
  stdout: Readable;
  stderr: Readable;
  kill(signal?: NodeJS.Signals): boolean;
}

export type SpawnCameraProcess = (
  config: CameraServiceConfig
) => SpawnedCameraProcess;

export interface RpicamCommand {
  command: string;
  args: string[];
}

export function buildRpicamCommand(
  config: CameraServiceConfig
): RpicamCommand {
  const args = [
    "--timeout",
    "0",
    "--nopreview",
    "--inline",
    "--autofocus-mode",
    config.autofocusMode,
    "--autofocus-range",
    config.autofocusRange,
    "--codec",
    "libav",
    "--libav-format",
    "mpegts",
    "--width",
    String(config.width),
    "--height",
    String(config.height),
    "--framerate",
    String(config.framerate),
    "--bitrate",
    String(config.bitrate),
    "--output",
    "-"
  ];

  if (config.lensPosition !== null) {
    args.splice(8, 0, "--lens-position", String(config.lensPosition));
  }

  if (config.useLowLatency) {
    args.splice(4, 0, "--low-latency");
  }

  return {
    command: config.rpicamBinary,
    args
  };
}

export function spawnCameraProcess(
  config: CameraServiceConfig
): SpawnedCameraProcess {
  const { command, args } = buildRpicamCommand(config);
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"]
  });

  const stdout = child.stdout ?? new PassThrough();
  const stderr = child.stderr ?? new PassThrough();

  return Object.assign(child, {
    stdout,
    stderr
  });
}
