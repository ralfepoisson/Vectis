import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerPlatformRoutes } from "./routes/platform-routes";

export function buildApp() {
  const app = Fastify({
    logger: false
  });

  app.register(cors, {
    origin: true
  });

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.register(registerPlatformRoutes, {
    prefix: "/api/v1"
  });

  return app;
}
