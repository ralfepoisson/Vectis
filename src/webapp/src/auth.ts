export interface AuthSession {
  token: string;
  userId: string;
  tenantId: string;
  displayName?: string;
  email?: string;
  role?: string;
  isAdmin: boolean;
  expiresAt: number;
}

const tokenStorageKey = "vectis.auth.token";

function decodeTokenPayload(token: string) {
  const parts = token.split(".");

  if (parts.length < 2) {
    throw new Error("The authentication token is malformed.");
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = atob(padded);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    throw new Error("The authentication token payload could not be decoded.");
  }
}

function readStringClaim(payload: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = payload[name];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return undefined;
}

export function parseSession(token: string): AuthSession {
  const payload = decodeTokenPayload(token);
  const userId = readStringClaim(payload, ["userid", "userId", "sub"]);
  const tenantId = readStringClaim(payload, ["accountId", "accountid", "tenantId", "tenantid"]);
  const displayName = readStringClaim(payload, ["displayName", "name"]);
  const email = readStringClaim(payload, ["email"]);
  const role = readStringClaim(payload, ["role"]);
  const exp = payload.exp;
  const expiresAt = typeof exp === "number" ? exp * 1000 : Number.NaN;

  if (!userId || !tenantId || !Number.isFinite(expiresAt)) {
    throw new Error("The authentication token is missing required Life2 claims.");
  }

  if (Date.now() >= expiresAt) {
    throw new Error("The authentication token has expired.");
  }

  return {
    token,
    userId,
    tenantId,
    displayName,
    email,
    role,
    isAdmin: role === "admin",
    expiresAt
  };
}

export function storeSession(token: string) {
  const session = parseSession(token);
  localStorage.setItem(tokenStorageKey, token);
  return session;
}

export function getStoredSession() {
  const token = localStorage.getItem(tokenStorageKey);

  if (!token) {
    return null;
  }

  try {
    return parseSession(token);
  } catch {
    clearStoredSession();
    return null;
  }
}

export function clearStoredSession() {
  localStorage.removeItem(tokenStorageKey);
}
