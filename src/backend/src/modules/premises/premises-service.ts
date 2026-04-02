import {
  CameraStatus,
  PremisesType,
  Prisma,
  type Camera,
  type Premises,
  type PrismaClient
} from "@prisma/client";

import { notFound } from "../../lib/http-errors";
import { ensureActor } from "../context/actor-service";
import type { RequestContext } from "../context/request-context";
import type {
  CreateCameraInput,
  CreatePremisesInput,
  UpdateCameraInput,
  UpdatePremisesInput
} from "./premises-schemas";

const premisesTypeToDb: Record<CreatePremisesInput["type"], PremisesType> = {
  apartment: PremisesType.APARTMENT,
  factory: PremisesType.FACTORY,
  house: PremisesType.HOUSE,
  office: PremisesType.OFFICE,
  other: PremisesType.OTHER,
  retail: PremisesType.RETAIL,
  warehouse: PremisesType.WAREHOUSE
};

const premisesTypeFromDb: Record<PremisesType, CreatePremisesInput["type"]> = {
  [PremisesType.APARTMENT]: "apartment",
  [PremisesType.FACTORY]: "factory",
  [PremisesType.HOUSE]: "house",
  [PremisesType.OFFICE]: "office",
  [PremisesType.OTHER]: "other",
  [PremisesType.RETAIL]: "retail",
  [PremisesType.WAREHOUSE]: "warehouse"
};

const cameraStatusToDb: Record<CreateCameraInput["status"], CameraStatus> = {
  degraded: CameraStatus.DEGRADED,
  maintenance: CameraStatus.MAINTENANCE,
  offline: CameraStatus.OFFLINE,
  online: CameraStatus.ONLINE
};

const cameraStatusFromDb: Record<CameraStatus, CreateCameraInput["status"]> = {
  [CameraStatus.DEGRADED]: "degraded",
  [CameraStatus.MAINTENANCE]: "maintenance",
  [CameraStatus.OFFLINE]: "offline",
  [CameraStatus.ONLINE]: "online"
};

export class PremisesService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPremises(tenantId: string) {
    const premises = await this.prisma.premises.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    });

    return premises.map(mapPremises);
  }

  async getPremises(tenantId: string, premisesId: string) {
    const premises = await this.prisma.premises.findFirst({
      where: {
        id: premisesId,
        tenantId
      }
    });

    if (!premises) {
      throw notFound("Premises not found.");
    }

    return mapPremises(premises);
  }

  async createPremises(context: RequestContext, input: CreatePremisesInput) {
    const actor = await ensureActor(this.prisma, context);

    const premises = await this.prisma.premises.create({
      data: {
        tenantId: actor.tenantId,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        name: input.name,
        type: premisesTypeToDb[input.type],
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        countryCode: input.countryCode,
        notes: input.notes
      }
    });

    return mapPremises(premises);
  }

  async updatePremises(context: RequestContext, premisesId: string, input: UpdatePremisesInput) {
    const actor = await ensureActor(this.prisma, context);
    await this.assertPremisesExists(actor.tenantId, premisesId);

    const premises = await this.prisma.premises.update({
      where: { id: premisesId },
      data: {
        ...mapPremisesUpdateInput(input),
        updatedByUserId: actor.userId
      }
    });

    return mapPremises(premises);
  }

  async deletePremises(context: RequestContext, premisesId: string) {
    const actor = await ensureActor(this.prisma, context);
    await this.assertPremisesExists(actor.tenantId, premisesId);

    await this.prisma.premises.delete({
      where: { id: premisesId }
    });
  }

  async listCameras(tenantId: string, premisesId: string) {
    await this.assertPremisesExists(tenantId, premisesId);

    const cameras = await this.prisma.camera.findMany({
      where: {
        tenantId,
        premisesId
      },
      orderBy: { createdAt: "asc" }
    });

    return cameras.map(mapCamera);
  }

  async getCamera(tenantId: string, premisesId: string, cameraId: string) {
    const camera = await this.prisma.camera.findFirst({
      where: {
        id: cameraId,
        tenantId,
        premisesId
      }
    });

    if (!camera) {
      throw notFound("Camera not found.");
    }

    return mapCamera(camera);
  }

  async createCamera(context: RequestContext, premisesId: string, input: CreateCameraInput) {
    const actor = await ensureActor(this.prisma, context);
    await this.assertPremisesExists(actor.tenantId, premisesId);

    const camera = await this.prisma.camera.create({
      data: {
        tenantId: actor.tenantId,
        premisesId,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
        name: input.name,
        streamUrl: input.streamUrl,
        status: cameraStatusToDb[input.status],
        model: input.model,
        serialNumber: input.serialNumber,
        locationDescription: input.locationDescription
      }
    });

    return mapCamera(camera);
  }

  async updateCamera(
    context: RequestContext,
    premisesId: string,
    cameraId: string,
    input: UpdateCameraInput
  ) {
    const actor = await ensureActor(this.prisma, context);
    await this.assertCameraExists(actor.tenantId, premisesId, cameraId);

    const camera = await this.prisma.camera.update({
      where: { id: cameraId },
      data: {
        ...mapCameraUpdateInput(input),
        updatedByUserId: actor.userId
      }
    });

    return mapCamera(camera);
  }

  async deleteCamera(context: RequestContext, premisesId: string, cameraId: string) {
    const actor = await ensureActor(this.prisma, context);
    await this.assertCameraExists(actor.tenantId, premisesId, cameraId);

    await this.prisma.camera.delete({
      where: { id: cameraId }
    });
  }

  private async assertPremisesExists(tenantId: string, premisesId: string) {
    const premises = await this.prisma.premises.findFirst({
      where: {
        id: premisesId,
        tenantId
      },
      select: {
        id: true
      }
    });

    if (!premises) {
      throw notFound("Premises not found.");
    }
  }

  private async assertCameraExists(tenantId: string, premisesId: string, cameraId: string) {
    const camera = await this.prisma.camera.findFirst({
      where: {
        id: cameraId,
        tenantId,
        premisesId
      },
      select: {
        id: true
      }
    });

    if (!camera) {
      throw notFound("Camera not found.");
    }
  }
}

function mapPremises(premises: Premises) {
  return {
    id: premises.id,
    tenantId: premises.tenantId,
    name: premises.name,
    type: premisesTypeFromDb[premises.type],
    addressLine1: premises.addressLine1,
    addressLine2: premises.addressLine2,
    city: premises.city,
    state: premises.state,
    postalCode: premises.postalCode,
    countryCode: premises.countryCode,
    notes: premises.notes,
    createdByUserId: premises.createdByUserId,
    updatedByUserId: premises.updatedByUserId,
    createdAt: premises.createdAt.toISOString(),
    updatedAt: premises.updatedAt.toISOString()
  };
}

function mapCamera(camera: Camera) {
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
    createdByUserId: camera.createdByUserId,
    updatedByUserId: camera.updatedByUserId,
    createdAt: camera.createdAt.toISOString(),
    updatedAt: camera.updatedAt.toISOString()
  };
}

function mapPremisesUpdateInput(input: UpdatePremisesInput): Prisma.PremisesUncheckedUpdateInput {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    city: input.city,
    countryCode: input.countryCode,
    name: input.name,
    notes: input.notes,
    postalCode: input.postalCode,
    state: input.state,
    type: input.type ? premisesTypeToDb[input.type] : undefined
  };
}

function mapCameraUpdateInput(input: UpdateCameraInput): Prisma.CameraUncheckedUpdateInput {
  return {
    locationDescription: input.locationDescription,
    model: input.model,
    name: input.name,
    serialNumber: input.serialNumber,
    status: input.status ? cameraStatusToDb[input.status] : undefined,
    streamUrl: input.streamUrl
  };
}
