import type { FastifyInstance } from "fastify";

import { requireTenantContext, requireUserContext } from "../context/request-context";
import {
  createCameraSchema,
  createPremisesSchema,
  updateCameraSchema,
  updatePremisesSchema
} from "./premises-schemas";
import { PremisesService } from "./premises-service";

export async function registerPremisesRoutes(app: FastifyInstance) {
  const premisesService = new PremisesService(app.prisma);

  app.get("/premises", async (request) => {
    const tenantId = requireTenantContext(request);
    const items = await premisesService.listPremises(tenantId);

    return { items };
  });

  app.post("/premises", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = createPremisesSchema.parse(request.body);
    const premises = await premisesService.createPremises(request.requestContext, payload);

    reply.code(201);
    return { premises };
  });

  app.get("/premises/:premisesId", async (request) => {
    const tenantId = requireTenantContext(request);
    const { premisesId } = request.params as { premisesId: string };
    const premises = await premisesService.getPremises(tenantId, premisesId);

    return { premises };
  });

  app.patch("/premises/:premisesId", async (request) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = updatePremisesSchema.parse(request.body);
    const { premisesId } = request.params as { premisesId: string };
    const premises = await premisesService.updatePremises(request.requestContext, premisesId, payload);

    return { premises };
  });

  app.delete("/premises/:premisesId", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const { premisesId } = request.params as { premisesId: string };
    await premisesService.deletePremises(request.requestContext, premisesId);

    reply.code(204);
  });

  app.get("/premises/:premisesId/cameras", async (request) => {
    const tenantId = requireTenantContext(request);
    const { premisesId } = request.params as { premisesId: string };
    const items = await premisesService.listCameras(tenantId, premisesId);

    return { items };
  });

  app.post("/premises/:premisesId/cameras", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = createCameraSchema.parse(request.body);
    const { premisesId } = request.params as { premisesId: string };
    const camera = await premisesService.createCamera(request.requestContext, premisesId, payload);

    reply.code(201);
    return { camera };
  });

  app.get("/premises/:premisesId/cameras/:cameraId", async (request) => {
    const tenantId = requireTenantContext(request);
    const { cameraId, premisesId } = request.params as {
      cameraId: string;
      premisesId: string;
    };
    const camera = await premisesService.getCamera(tenantId, premisesId, cameraId);

    return { camera };
  });

  app.patch("/premises/:premisesId/cameras/:cameraId", async (request) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = updateCameraSchema.parse(request.body);
    const { cameraId, premisesId } = request.params as {
      cameraId: string;
      premisesId: string;
    };
    const camera = await premisesService.updateCamera(
      request.requestContext,
      premisesId,
      cameraId,
      payload
    );

    return { camera };
  });

  app.delete("/premises/:premisesId/cameras/:cameraId", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const { cameraId, premisesId } = request.params as {
      cameraId: string;
      premisesId: string;
    };
    await premisesService.deleteCamera(request.requestContext, premisesId, cameraId);

    reply.code(204);
  });
}
