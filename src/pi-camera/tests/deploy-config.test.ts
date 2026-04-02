import { describe, expect, it } from "vitest";

import { readCameraServiceConfig } from "../src/config";
import {
  renderPiCameraEnvironmentFile,
  renderPiCameraSystemdUnit
} from "../src/deploy-config";

describe("Pi camera deployment config", () => {
  it("renders an environment file for the camera service", () => {
    const config = readCameraServiceConfig({
      HOST: "0.0.0.0",
      PORT: "9090",
      STREAM_PATH: "/camera-stream",
      HEALTH_PATH: "/camera-health",
      RPICAM_BIN: "/usr/bin/rpicam-vid",
      CAMERA_WIDTH: "1280",
      CAMERA_HEIGHT: "720",
      CAMERA_FRAMERATE: "25",
      CAMERA_BITRATE: "2000000",
      CAMERA_LOW_LATENCY: "false"
    });

    expect(renderPiCameraEnvironmentFile(config)).toBe(
      [
        "HOST=0.0.0.0",
        "PORT=9090",
        "STREAM_PATH=/camera-stream",
        "HEALTH_PATH=/camera-health",
        "RPICAM_BIN=/usr/bin/rpicam-vid",
        "CAMERA_WIDTH=1280",
        "CAMERA_HEIGHT=720",
        "CAMERA_FRAMERATE=25",
        "CAMERA_BITRATE=2000000",
        "CAMERA_LOW_LATENCY=false"
      ].join("\n")
    );
  });

  it("renders a systemd unit for the camera service", () => {
    expect(
      renderPiCameraSystemdUnit({
        serviceName: "vectis-pi-camera",
        installDir: "/opt/vectis/pi-camera",
        environmentFilePath: "/opt/vectis/pi-camera/vectis-pi-camera.env",
        user: "ralfe",
        group: "ralfe"
      })
    ).toContain("ExecStart=/usr/bin/node /opt/vectis/pi-camera/dist/server.js");
    expect(
      renderPiCameraSystemdUnit({
        serviceName: "vectis-pi-camera",
        installDir: "/opt/vectis/pi-camera",
        environmentFilePath: "/opt/vectis/pi-camera/vectis-pi-camera.env",
        user: "ralfe",
        group: "ralfe"
      })
    ).toContain("EnvironmentFile=/opt/vectis/pi-camera/vectis-pi-camera.env");
  });
});
