import type { FastifyRequest } from "fastify";

import { unauthorized } from "../../lib/http-errors";

export interface RequestContext {
  tenantId?: string;
  userId?: string;
  displayName?: string;
  email?: string;
}

const tenantClaimNames = ["accountId", "accountid", "tenantId", "tenantid"] as const;
const userClaimNames = ["userid", "userId", "sub"] as const;
const displayNameClaimNames = ["displayName", "name"] as const;
const emailClaimNames = ["email"] as const;

function getHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function decodeJwtPayload(token: string) {
  const segments = token.split(".");

  if (segments.length < 2) {
    return undefined;
  }

  try {
    const base64 = segments[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[1].length / 4) * 4, "=");

    const payload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function getClaim(payload: Record<string, unknown> | undefined, claimNames: readonly string[]) {
  if (!payload) {
    return undefined;
  }

  for (const claimName of claimNames) {
    const value = payload[claimName];

    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return undefined;
}

export function buildRequestContext(request: FastifyRequest): RequestContext {
  const authorizationHeader = getHeaderValue(request.headers.authorization);
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : undefined;
  const jwtPayload = bearerToken ? decodeJwtPayload(bearerToken) : undefined;

  return {
    tenantId: getHeaderValue(request.headers["x-tenant-id"]) ?? getClaim(jwtPayload, tenantClaimNames),
    userId: getHeaderValue(request.headers["x-user-id"]) ?? getClaim(jwtPayload, userClaimNames),
    displayName: getClaim(jwtPayload, displayNameClaimNames),
    email: getClaim(jwtPayload, emailClaimNames)
  };
}

export function requireTenantContext(request: FastifyRequest) {
  const tenantId = request.requestContext.tenantId;

  if (!tenantId) {
    throw unauthorized("Tenant context is required for this resource.");
  }

  return tenantId;
}

export function requireUserContext(request: FastifyRequest) {
  const userId = request.requestContext.userId;

  if (!userId) {
    throw unauthorized("User context is required for this operation.");
  }

  return userId;
}
