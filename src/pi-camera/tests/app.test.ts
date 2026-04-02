import { request as httpRequest } from "node:http";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app";
import { readCameraServiceConfig } from "../src/config";
import type { HeartbeatSnapshot } from "../src/heartbeat";
import type { SpawnedCameraProcess } from "../src/rpicam";

class FakeCameraProcess extends EventEmitter implements SpawnedCameraProcess {
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn(() => true);
}

describe("Pi camera app", () => {
  const config = readCameraServiceConfig({
    PORT: "8080"
  });

  const processes: FakeCameraProcess[] = [];

  const app = buildApp({
    config,
    spawnProcess: () => {
      const process = new FakeCameraProcess();
      processes.push(process);
      return process;
    },
    heartbeatProvider: async (): Promise<HeartbeatSnapshot> => ({
      ipAddresses: ["192.168.1.40"],
      uptimeSeconds: 1234,
      temperatureCelsius: 48.5
    })
  });

  let baseUrl = "";

  beforeAll(async () => {
    await app.listen({ host: "127.0.0.1", port: 0 });
    baseUrl = app.server.address() && typeof app.server.address() !== "string"
      ? `http://127.0.0.1:${app.server.address().port}`
      : "";
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports stream capabilities on the health endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: config.healthPath
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      stream: {
        path: "/stream",
        format: "mpegts",
        codec: "h264",
        width: 1920,
        height: 1080,
        framerate: 30,
        autofocusMode: "continuous",
        autofocusRange: "normal",
        lensPosition: null
      }
    });
  });

  it("returns heartbeat information for the agent", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/heartbeat"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ipAddresses: ["192.168.1.40"],
      uptimeSeconds: 1234,
      temperatureCelsius: 48.5
    });
  });

  it("streams camera bytes to the HTTP client and stops on disconnect", async () => {
    const responsePromise = new Promise<{
      headers: Record<string, string | string[] | undefined>;
      firstChunk: string;
    }>((resolve, reject) => {
      const request = httpRequest(`${baseUrl}${config.streamPath}`, (incoming) => {
        incoming.once("data", (chunk) => {
          resolve({
            headers: incoming.headers,
            firstChunk: chunk.toString()
          });
          incoming.destroy();
        });
      });

      request.on("error", reject);
      request.end();
    });

    await vi.waitFor(() => {
      expect(processes.length).toBeGreaterThan(0);
    });

    const process = processes.at(-1);

    if (!process) {
      throw new Error("Expected a spawned camera process");
    }

    process.stdout.write("frame-1");

    const response = await responsePromise;

    expect(response.headers["content-type"]).toBe("video/mp2t");
    expect(response.firstChunk).toBe("frame-1");

    await vi.waitFor(() => {
      expect(process.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });
});
