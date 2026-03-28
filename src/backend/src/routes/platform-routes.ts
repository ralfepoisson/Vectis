import type { FastifyInstance } from "fastify";

import {
  automationRules,
  cameraSources,
  platformOverview,
  visionEvents
} from "@vectis/shared";

export async function registerPlatformRoutes(app: FastifyInstance) {
  app.get("/platform/overview", async () => ({
    overview: platformOverview
  }));

  app.get("/cameras", async () => ({
    items: cameraSources
  }));

  app.get("/events", async () => ({
    items: visionEvents
  }));

  app.get("/rules", async () => ({
    items: automationRules
  }));
}
