import type { PrismaClient } from "@prisma/client";

import type { RequestContext } from "../modules/context/request-context";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    requestContext: RequestContext;
  }
}
