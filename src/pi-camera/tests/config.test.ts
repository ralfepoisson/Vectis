import { describe, expect, it } from "vitest";

import { readCameraServiceConfig } from "../src/config";
import { buildRpicamCommand } from "../src/rpicam";

describe("Pi camera config", () => {
  it("reads sensible defaults for the Pi streaming service", () => {
    const config = readCameraServiceConfig({});

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 8080,
      streamPath: "/stream",
      healthPath: "/health",
      rpicamBinary: "rpicam-vid",
      width: 1920,
      height: 1080,
      framerate: 30,
      bitrate: 4_000_000,
      useLowLatency: true
    });
  });

  it("builds an MPEG-TS streaming command for rpicam-vid", () => {
    const config = readCameraServiceConfig({
      CAMERA_WIDTH: "1280",
      CAMERA_HEIGHT: "720",
      CAMERA_FRAMERATE: "25",
      CAMERA_BITRATE: "2000000",
      CAMERA_LOW_LATENCY: "false",
      RPICAM_BIN: "custom-rpicam-vid"
    });

    expect(buildRpicamCommand(config)).toEqual({
      command: "custom-rpicam-vid",
      args: [
        "--timeout",
        "0",
        "--nopreview",
        "--inline",
        "--codec",
        "libav",
        "--libav-format",
        "mpegts",
        "--width",
        "1280",
        "--height",
        "720",
        "--framerate",
        "25",
        "--bitrate",
        "2000000",
        "--output",
        "-"
      ]
    });
  });

  it("rejects invalid numeric configuration", () => {
    expect(() =>
      readCameraServiceConfig({
        CAMERA_FRAMERATE: "0"
      })
    ).toThrow("CAMERA_FRAMERATE must be a positive number");
  });
});
