import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { PassThrough } from "node:stream";

import { readCameraServiceConfig, type CameraServiceConfig } from "./config";
import {
  readHeartbeatSnapshot,
  type HeartbeatProvider
} from "./heartbeat";
import {
  spawnCameraProcess,
  type SpawnCameraProcess,
  type SpawnedCameraProcess
} from "./rpicam";

export interface BuildAppOptions {
  config?: CameraServiceConfig;
  spawnProcess?: SpawnCameraProcess;
  heartbeatProvider?: HeartbeatProvider;
}

function pipeCameraOutput(
  process: SpawnedCameraProcess,
  app: FastifyInstance
): PassThrough {
  const stream = new PassThrough();

  process.stdout.pipe(stream);

  process.stderr.on("data", (chunk) => {
    app.log.error({ chunk: chunk.toString() }, "rpicam-vid stderr");
  });

  process.on("close", () => {
    stream.end();
  });

  process.on("error", (error) => {
    app.log.error(error, "rpicam-vid failed");
    stream.destroy(error);
  });

  return stream;
}

export function buildApp(options: BuildAppOptions = {}) {
  const config = options.config ?? readCameraServiceConfig();
  const startCameraProcess = options.spawnProcess ?? spawnCameraProcess;
  const heartbeatProvider = options.heartbeatProvider ?? readHeartbeatSnapshot;

  const app = Fastify({
    logger: false
  });

  app.get(config.healthPath, async () => ({
    status: "ok",
    stream: {
      path: config.streamPath,
      format: "mpegts",
      codec: "h264",
      width: config.width,
      height: config.height,
      framerate: config.framerate
    }
  }));

  app.get("/heartbeat", async () => heartbeatProvider());

  app.get(config.streamPath, async (request, reply) => {
    const process = startCameraProcess(config);
    const output = pipeCameraOutput(process, app);

    request.raw.on("close", () => {
      process.kill("SIGTERM");
    });

    reply.header("Content-Type", "video/mp2t");
    reply.header("Cache-Control", "no-store");
    reply.header("Connection", "close");
    reply.header("X-Accel-Buffering", "no");

    return reply.send(output);
  });

  return app;
}
