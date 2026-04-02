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
      useLowLatency: true,
      autofocusMode: "continuous",
      autofocusRange: "normal",
      lensPosition: null
    });
  });

  it("builds an MPEG-TS streaming command for rpicam-vid", () => {
    const config = readCameraServiceConfig({
      CAMERA_WIDTH: "1280",
      CAMERA_HEIGHT: "720",
      CAMERA_FRAMERATE: "25",
      CAMERA_BITRATE: "2000000",
      CAMERA_LOW_LATENCY: "false",
      RPICAM_BIN: "custom-rpicam-vid",
      CAMERA_AUTOFOCUS_MODE: "manual",
      CAMERA_AUTOFOCUS_RANGE: "macro",
      CAMERA_LENS_POSITION: "0.5"
    });

    expect(buildRpicamCommand(config)).toEqual({
      command: "custom-rpicam-vid",
      args: [
        "--timeout",
        "0",
        "--nopreview",
        "--inline",
        "--autofocus-mode",
        "manual",
        "--autofocus-range",
        "macro",
        "--lens-position",
        "0.5",
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

  it("rejects invalid autofocus configuration", () => {
    expect(() =>
      readCameraServiceConfig({
        CAMERA_AUTOFOCUS_MODE: "tracking"
      })
    ).toThrow("CAMERA_AUTOFOCUS_MODE must be one of: default, manual, auto, continuous");
  });
});
