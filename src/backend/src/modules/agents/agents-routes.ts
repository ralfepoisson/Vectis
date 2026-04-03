import type { FastifyInstance } from "fastify";

import { requireTenantContext, requireUserContext } from "../context/request-context";
import type { FrameStorageService } from "../../services/frame-storage-service";
import {
  createAgentSchema,
  createCameraHealthReportSchema,
  ingestFramesSchema,
  updateAgentSchema
} from "./agents-schemas";
import { AgentsService } from "./agents-service";

export interface AgentRoutesOptions {
  frameStorage: FrameStorageService;
}

export async function registerAgentRoutes(app: FastifyInstance, options: AgentRoutesOptions) {
  const agentsService = new AgentsService(app.prisma, options.frameStorage);

  app.get("/agents", async (request) => {
    const tenantId = requireTenantContext(request);
    const items = await agentsService.listAgents(tenantId);

    return { items };
  });

  app.post("/agents", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = createAgentSchema.parse(request.body);
    const agent = await agentsService.createAgent(request.requestContext, payload);

    reply.code(201);
    return { agent };
  });

  app.get("/agents/:agentId", async (request) => {
    const tenantId = requireTenantContext(request);
    const { agentId } = request.params as { agentId: string };
    const agent = await agentsService.getAgent(tenantId, agentId);

    return { agent };
  });

  app.get("/agents/:agentId/runtime-config", async (request) => {
    const tenantId = requireTenantContext(request);
    const { agentId } = request.params as { agentId: string };
    const runtimeConfig = await agentsService.getRuntimeConfig(tenantId, agentId);

    return { runtimeConfig };
  });

  app.patch("/agents/:agentId", async (request) => {
    requireTenantContext(request);
    requireUserContext(request);

    const payload = updateAgentSchema.parse(request.body);
    const { agentId } = request.params as { agentId: string };
    const agent = await agentsService.updateAgent(request.requestContext, agentId, payload);

    return { agent };
  });

  app.delete("/agents/:agentId", async (request, reply) => {
    requireTenantContext(request);
    requireUserContext(request);

    const { agentId } = request.params as { agentId: string };
    await agentsService.deleteAgent(request.requestContext, agentId);

    reply.code(204);
  });

  app.post("/agents/:agentId/camera-health", async (request, reply) => {
    const tenantId = requireTenantContext(request);
    const payload = createCameraHealthReportSchema.parse(request.body);
    const { agentId } = request.params as { agentId: string };
    const healthReport = await agentsService.createCameraHealthReport(tenantId, agentId, payload);

    reply.code(202);
    return { healthReport };
  });

  app.post("/agents/:agentId/frames", async (request, reply) => {
    const tenantId = requireTenantContext(request);
    const payload = ingestFramesSchema.parse(request.body);
    const { agentId } = request.params as { agentId: string };
    const items = await agentsService.ingestFrames(tenantId, agentId, payload);

    reply.code(202);
    return { items };
  });
}
