import { createHmac, timingSafeEqual } from "node:crypto";
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

function verifyHs256Signature(token: string, secret: string) {
  const segments = token.split(".");

  if (segments.length !== 3) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(`${segments[0]}.${segments[1]}`)
    .digest();

  try {
    const providedSignature = Buffer.from(segments[2], "base64url");

    if (providedSignature.length !== expectedSignature.length) {
      return false;
    }

    return timingSafeEqual(providedSignature, expectedSignature);
  } catch {
    return false;
  }
}

function decodeJwtHeader(token: string) {
  const segments = token.split(".");

  if (segments.length < 1) {
    return undefined;
  }

  try {
    const base64 = segments[0]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[0].length / 4) * 4, "=");

    const header = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(header) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function validateLife2Token(token: string) {
  const payload = decodeJwtPayload(token);
  const secret = process.env.LIFE2_AUTH_SHARED_SECRET;

  if (secret) {
    const header = decodeJwtHeader(token);
    const algorithm = typeof header?.alg === "string" ? header.alg : undefined;

    if (algorithm !== "HS256" || !verifyHs256Signature(token, secret)) {
      throw unauthorized("The bearer token is invalid.");
    }
  }

  if (!payload) {
    throw unauthorized("The bearer token payload is invalid.");
  }

  if (payload.iss !== "life2.ralfe.me") {
    throw unauthorized("The bearer token issuer is invalid.");
  }

  if (payload.aud !== "account") {
    throw unauthorized("The bearer token audience is invalid.");
  }

  if (typeof payload.exp !== "number" || Date.now() >= payload.exp * 1000) {
    throw unauthorized("The bearer token has expired.");
  }

  return payload;
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
  const jwtPayload = bearerToken ? validateLife2Token(bearerToken) : undefined;

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
