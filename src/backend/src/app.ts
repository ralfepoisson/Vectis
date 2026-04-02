import path from "node:path";

import cors from "@fastify/cors";
import Fastify from "fastify";
import { ZodError } from "zod";

import { HttpError } from "./lib/http-errors";
import { registerAgentRoutes } from "./modules/agents/agents-routes";
import { buildRequestContext } from "./modules/context/request-context";
import { registerPremisesRoutes } from "./modules/premises/premises-routes";
import { registerPrisma, type PrismaPluginOptions } from "./plugins/prisma";
import { registerPlatformRoutes } from "./routes/platform-routes";
import {
  createFrameStorageFromEnv,
  type FrameStorageService
} from "./services/frame-storage-service";

export interface BuildAppOptions extends PrismaPluginOptions {
  frameStoragePath?: string;
  frameStorage?: FrameStorageService;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false
  });

  app.register(cors, {
    origin: true
  });

  registerPrisma(app, options);

  app.addHook("onRequest", async (request) => {
    request.requestContext = buildRequestContext(request);
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.status(error.statusCode).send({
        error: error.title,
        message: error.message
      });
      return;
    }

    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];

      reply.status(400).send({
        error: "Bad Request",
        message: firstIssue?.message ?? "The request payload is invalid."
      });
      return;
    }

    const unexpectedMessage =
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred."
        : error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

    reply.status(500).send({
      error: "Internal Server Error",
      message: unexpectedMessage
    });
  });

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.register(registerPlatformRoutes, {
    prefix: "/api/v1"
  });

  app.register(registerPremisesRoutes, {
    prefix: "/api/v1"
  });

  app.register(registerAgentRoutes, {
    prefix: "/api/v1",
    frameStorage:
      options.frameStorage ??
      createFrameStorageFromEnv({
        defaultLocalPath: options.frameStoragePath ?? path.resolve(process.cwd(), "storage")
      })
  });

  return app;
}
