import type { FastifyInstance } from "fastify";

import { PrismaClient } from "@prisma/client";

export interface PrismaPluginOptions {
  databaseUrl?: string;
  prisma?: PrismaClient;
}

export function registerPrisma(app: FastifyInstance, options: PrismaPluginOptions) {
  const databaseUrl =
    options.databaseUrl ??
    process.env.DATABASE_URL ??
    "postgresql://postgres@localhost:5432/vectis_dev?schema=public";

  const prisma =
    options.prisma ??
    new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl
        }
      }
    });

  app.decorate("prisma", prisma);

  app.addHook("onReady", async () => {
    await prisma.$connect();
  });

  if (!options.prisma) {
    app.addHook("onClose", async () => {
      await prisma.$disconnect();
    });
  }
}
