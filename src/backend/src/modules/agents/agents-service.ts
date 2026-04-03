import {
  AgentStatus,
  CameraStatus,
  Prisma,
  PremisesType,
  type Agent,
  type CameraFrame,
  type CameraHealthReport,
  type Premises,
  type PrismaClient
} from "@prisma/client";

import { notFound } from "../../lib/http-errors";
import type { FrameStorageService } from "../../services/frame-storage-service";
import { ensureActor } from "../context/actor-service";
import type { RequestContext } from "../context/request-context";
import type {
  CreateAgentInput,
  CreateCameraHealthReportInput,
  IngestFramesInput,
  UpdateAgentInput
} from "./agents-schemas";

const agentStatusToDb: Record<CreateAgentInput["status"], AgentStatus> = {
  maintenance: AgentStatus.MAINTENANCE,
  offline: AgentStatus.OFFLINE,
  online: AgentStatus.ONLINE
};

const agentStatusFromDb: Record<AgentStatus, CreateAgentInput["status"]> = {
  [AgentStatus.MAINTENANCE]: "maintenance",
  [AgentStatus.OFFLINE]: "offline",
  [AgentStatus.ONLINE]: "online"
};

const cameraStatusToDb: Record<CreateCameraHealthReportInput["status"], CameraStatus> = {
  degraded: CameraStatus.DEGRADED,
  maintenance: CameraStatus.MAINTENANCE,
  offline: CameraStatus.OFFLINE,
  online: CameraStatus.ONLINE
};

const cameraStatusFromDb: Record<CameraStatus, CreateCameraHealthReportInput["status"]> = {
  [CameraStatus.DEGRADED]: "degraded",
  [CameraStatus.MAINTENANCE]: "maintenance",
  [CameraStatus.OFFLINE]: "offline",
  [CameraStatus.ONLINE]: "online"
};

export class AgentsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly frameStorageService: FrameStorageService
  ) {}

  async listAgents(tenantId: string) {
    const items = await this.prisma.agent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    });

    return items.map(mapAgent);
  }

  async getAgent(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        tenantId
      }
    });

    if (!agent) {
      throw notFound("Agent not found.");
    }

    return mapAgent(agent);
  }

  async getRuntimeConfig(tenantId: string, agentId: string) {
    const agent = await assertAgentExists(this.prisma, tenantId, agentId);
    const premises = await assertPremisesExists(this.prisma, tenantId, agent.premisesId);
    const cameras = await this.prisma.camera.findMany({
      where: {
        tenantId,
        premisesId: agent.premisesId
      },
      orderBy: { createdAt: "asc" }
    });

    return {
      agent: mapAgent(agent),
      premises: mapPremisesSummary(premises),
      cameras: cameras.map(mapRuntimeCamera),
      pollIntervalSeconds: 600
    };
  }

  async createAgent(context: RequestContext, input: CreateAgentInput) {
    const actor = await ensureActor(this.prisma, context);
    await assertPremisesExists(this.prisma, actor.tenantId, input.premisesId);

    const agent = await this.prisma.agent.create({
      data: {
        tenantId: actor.tenantId,
        premisesId: input.premisesId,
        name: input.name,
        status: agentStatusToDb[input.status],
        softwareVersion: input.softwareVersion,
        locationDescription: input.locationDescription,
        hostName: input.hostName,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId
      }
    });

    return mapAgent(agent);
  }

  async updateAgent(context: RequestContext, agentId: string, input: UpdateAgentInput) {
    const actor = await ensureActor(this.prisma, context);
    await assertAgentExists(this.prisma, actor.tenantId, agentId);

    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...mapAgentUpdateInput(input),
        updatedByUserId: actor.userId
      }
    });

    return mapAgent(agent);
  }

  async deleteAgent(context: RequestContext, agentId: string) {
    const actor = await ensureActor(this.prisma, context);
    await assertAgentExists(this.prisma, actor.tenantId, agentId);

    await this.prisma.agent.delete({
      where: { id: agentId }
    });
  }

  async createCameraHealthReport(tenantId: string, agentId: string, input: CreateCameraHealthReportInput) {
    const agent = await assertAgentExists(this.prisma, tenantId, agentId);
    await assertCameraExists(this.prisma, tenantId, input.cameraId);

    const report = await this.prisma.$transaction(async (transaction) => {
      const createdReport = await transaction.cameraHealthReport.create({
        data: {
          tenantId,
          agentId: agent.id,
          cameraId: input.cameraId,
          status: cameraStatusToDb[input.status],
          temperatureCelsius: input.temperatureCelsius,
          uptimeSeconds: input.uptimeSeconds,
          ipAddress: input.ipAddress,
          reportedAt: new Date(input.reportedAt)
        }
      });

      await transaction.camera.update({
        where: { id: input.cameraId },
        data: {
          status: cameraStatusToDb[input.status]
        }
      });

      return createdReport;
    });

    return mapCameraHealthReport(report);
  }

  async ingestFrames(tenantId: string, agentId: string, input: IngestFramesInput) {
    const agent = await assertAgentExists(this.prisma, tenantId, agentId);
    const persistedFrames: CameraFrame[] = [];

    for (const frame of input.frames) {
      await assertCameraExists(this.prisma, tenantId, frame.cameraId);

      const storedFrame = await this.frameStorageService.storeFrame({
        tenantId,
        agentId: agent.id,
        cameraId: frame.cameraId,
        capturedAt: frame.timestamp,
        contentType: frame.contentType,
        dataBase64: frame.dataBase64
      });

      const persisted = await this.prisma.cameraFrame.create({
        data: {
          tenantId,
          agentId: agent.id,
          cameraId: frame.cameraId,
          storagePath: storedFrame.storagePath,
          contentType: frame.contentType,
          byteSize: storedFrame.byteSize,
          capturedAt: new Date(frame.timestamp)
        }
      });

      persistedFrames.push(persisted);
    }

    return persistedFrames.map(mapCameraFrame);
  }
}

async function assertPremisesExists(prisma: PrismaClient, tenantId: string, premisesId: string) {
  const premises = await prisma.premises.findFirst({
    where: {
      id: premisesId,
      tenantId
    },
  });

  if (!premises) {
    throw notFound("Premises not found.");
  }

  return premises;
}

async function assertAgentExists(prisma: PrismaClient, tenantId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      tenantId
    }
  });

  if (!agent) {
    throw notFound("Agent not found.");
  }

  return agent;
}

async function assertCameraExists(prisma: PrismaClient, tenantId: string, cameraId: string) {
  const camera = await prisma.camera.findFirst({
    where: {
      id: cameraId,
      tenantId
    },
    select: {
      id: true
    }
  });

  if (!camera) {
    throw notFound("Camera not found.");
  }
}

function mapAgent(agent: Agent) {
  return {
    id: agent.id,
    tenantId: agent.tenantId,
    premisesId: agent.premisesId,
    name: agent.name,
    status: agentStatusFromDb[agent.status],
    softwareVersion: agent.softwareVersion,
    locationDescription: agent.locationDescription,
    hostName: agent.hostName,
    createdByUserId: agent.createdByUserId,
    updatedByUserId: agent.updatedByUserId,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString()
  };
}

function mapPremisesSummary(premises: Premises) {
  return {
    id: premises.id,
    tenantId: premises.tenantId,
    name: premises.name,
    type: mapPremisesType(premises.type)
  };
}

function mapRuntimeCamera(camera: {
  id: string;
  tenantId: string;
  premisesId: string;
  name: string;
  streamUrl: string;
  status: CameraStatus;
  model: string | null;
  serialNumber: string | null;
  locationDescription: string | null;
}) {
  const derivedUrls = deriveCameraNetworkDetails(camera.streamUrl);
  return {
    id: camera.id,
    tenantId: camera.tenantId,
    premisesId: camera.premisesId,
    name: camera.name,
    streamUrl: camera.streamUrl,
    status: cameraStatusFromDb[camera.status],
    model: camera.model,
    serialNumber: camera.serialNumber,
    locationDescription: camera.locationDescription,
    ipAddress: derivedUrls.ipAddress,
    heartbeatUrl: derivedUrls.heartbeatUrl
  };
}

function deriveCameraNetworkDetails(streamUrl: string) {
  try {
    const parsed = new URL(streamUrl);
    const ipAddress = parsed.hostname;
    let heartbeatUrl: string | null = null;
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname === "/stream") {
      parsed.pathname = "/heartbeat";
      heartbeatUrl = parsed.toString();
    }
    return { ipAddress, heartbeatUrl };
  } catch {
    return { ipAddress: null, heartbeatUrl: null };
  }
}

function mapPremisesType(type: PremisesType) {
  switch (type) {
    case PremisesType.APARTMENT:
      return "apartment";
    case PremisesType.FACTORY:
      return "factory";
    case PremisesType.HOUSE:
      return "house";
    case PremisesType.OFFICE:
      return "office";
    case PremisesType.OTHER:
      return "other";
    case PremisesType.RETAIL:
      return "retail";
    case PremisesType.WAREHOUSE:
      return "warehouse";
  }
}

function mapCameraHealthReport(report: CameraHealthReport) {
  return {
    id: report.id,
    tenantId: report.tenantId,
    agentId: report.agentId,
    cameraId: report.cameraId,
    status: cameraStatusFromDb[report.status],
    temperatureCelsius: report.temperatureCelsius,
    uptimeSeconds: report.uptimeSeconds,
    ipAddress: report.ipAddress,
    reportedAt: report.reportedAt.toISOString(),
    receivedAt: report.receivedAt.toISOString()
  };
}

function mapCameraFrame(frame: CameraFrame) {
  return {
    id: frame.id,
    tenantId: frame.tenantId,
    agentId: frame.agentId,
    cameraId: frame.cameraId,
    storagePath: frame.storagePath,
    contentType: frame.contentType,
    byteSize: frame.byteSize,
    capturedAt: frame.capturedAt.toISOString(),
    receivedAt: frame.receivedAt.toISOString()
  };
}

function mapAgentUpdateInput(input: UpdateAgentInput): Prisma.AgentUncheckedUpdateInput {
  return {
    hostName: input.hostName,
    locationDescription: input.locationDescription,
    name: input.name,
    softwareVersion: input.softwareVersion,
    status: input.status ? agentStatusToDb[input.status] : undefined
  };
}
