import type { PrismaClient } from "@prisma/client";

import { unauthorized } from "../../lib/http-errors";
import type { RequestContext } from "./request-context";

export async function ensureActor(prisma: PrismaClient, context: RequestContext) {
  if (!context.tenantId || !context.userId) {
    throw unauthorized("Authenticated tenant and user context are required.");
  }

  await prisma.tenant.upsert({
    where: { id: context.tenantId },
    update: {},
    create: {
      id: context.tenantId
    }
  });

  await prisma.user.upsert({
    where: { id: context.userId },
    update: {
      tenantId: context.tenantId,
      displayName: context.displayName,
      email: context.email
    },
    create: {
      id: context.userId,
      tenantId: context.tenantId,
      displayName: context.displayName,
      email: context.email
    }
  });

  return {
    tenantId: context.tenantId,
    userId: context.userId
  };
}
