import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app";

describe("Vectis backend", () => {
  const execFileAsync = promisify(execFile);
  const adminDatabaseUrl = "postgresql://postgres@localhost:5432/postgres?schema=public";
  const backendDirectory = fileURLToPath(new URL("../", import.meta.url));
  const testDatabaseName = `vectis_test_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const storageRootPromise = mkdtemp(path.join(os.tmpdir(), "vectis-storage-"));
  let databaseUrl: string;
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    databaseUrl = `postgresql://postgres@localhost:5432/${testDatabaseName}?schema=public`;

    const adminClient = new Client({
      connectionString: adminDatabaseUrl
    });

    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE "${testDatabaseName}"`);
    await adminClient.end();

    await execFileAsync(
      "npx",
      ["prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"],
      {
        cwd: backendDirectory,
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl
        }
      }
    );

    app = buildApp({
      databaseUrl,
      frameStoragePath: await storageRootPromise
    });

    await app.ready();
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    const adminClient = new Client({
      connectionString: adminDatabaseUrl
    });

    await adminClient.connect();
    await adminClient.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [testDatabaseName]
    );
    await adminClient.query(`DROP DATABASE IF EXISTS "${testDatabaseName}"`);
    await adminClient.end();
    await rm(await storageRootPromise, { recursive: true, force: true });
  });

  it("serves health and platform overview endpoints", async () => {
    const health = await app.inject({
      method: "GET",
      url: "/health"
    });
    const overview = await app.inject({
      method: "GET",
      url: "/api/v1/platform/overview"
    });

    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    expect(overview.statusCode).toBe(200);
    expect(overview.json().overview.captureToAction).toHaveLength(5);
  });

  it("creates, lists, updates, and deletes tenant-scoped premises", async () => {
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-alpha",
        "x-user-id": "user-alpha"
      },
      payload: {
        name: "Riverside House",
        type: "house",
        addressLine1: "12 River Road",
        city: "Lyon",
        state: "Auvergne-Rhone-Alpes",
        postalCode: "69001",
        countryCode: "FR",
        notes: "Primary monitoring site"
      }
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json().premises).toMatchObject({
      tenantId: "tenant-alpha",
      createdByUserId: "user-alpha",
      name: "Riverside House",
      type: "house",
      city: "Lyon"
    });

    const createdPremisesId = createResponse.json().premises.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-alpha",
        "x-user-id": "user-alpha"
      }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().items).toHaveLength(1);
    expect(listResponse.json().items[0].id).toBe(createdPremisesId);

    const otherTenantListResponse = await app.inject({
      method: "GET",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-bravo",
        "x-user-id": "user-bravo"
      }
    });

    expect(otherTenantListResponse.statusCode).toBe(200);
    expect(otherTenantListResponse.json().items).toEqual([]);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/premises/${createdPremisesId}`,
      headers: {
        "x-tenant-id": "tenant-alpha",
        "x-user-id": "user-alpha"
      },
      payload: {
        type: "office",
        notes: "Converted into a regional office"
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().premises).toMatchObject({
      id: createdPremisesId,
      type: "office",
      notes: "Converted into a regional office"
    });

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/premises/${createdPremisesId}`,
      headers: {
        "x-tenant-id": "tenant-alpha",
        "x-user-id": "user-alpha"
      }
    });

    expect(deleteResponse.statusCode).toBe(204);

    const deletedLookupResponse = await app.inject({
      method: "GET",
      url: `/api/v1/premises/${createdPremisesId}`,
      headers: {
        "x-tenant-id": "tenant-alpha",
        "x-user-id": "user-alpha"
      }
    });

    expect(deletedLookupResponse.statusCode).toBe(404);
  });

  it("creates, lists, updates, and deletes cameras within a premises", async () => {
    const premisesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-cameras",
        "x-user-id": "user-cameras"
      },
      payload: {
        name: "North Factory",
        type: "factory",
        addressLine1: "3 Industry Way",
        city: "Grenoble",
        postalCode: "38000",
        countryCode: "FR"
      }
    });

    const premisesId = premisesResponse.json().premises.id as string;

    const createCameraResponse = await app.inject({
      method: "POST",
      url: `/api/v1/premises/${premisesId}/cameras`,
      headers: {
        "x-tenant-id": "tenant-cameras",
        "x-user-id": "user-cameras"
      },
      payload: {
        name: "Gate Camera",
        streamUrl: "rtsp://camera.local/gate",
        status: "online",
        model: "Axis P1465-LE",
        serialNumber: "AXIS-001",
        locationDescription: "North gate"
      }
    });

    expect(createCameraResponse.statusCode).toBe(201);
    expect(createCameraResponse.json().camera).toMatchObject({
      tenantId: "tenant-cameras",
      premisesId,
      name: "Gate Camera",
      streamUrl: "rtsp://camera.local/gate"
    });

    const cameraId = createCameraResponse.json().camera.id as string;

    const listCameraResponse = await app.inject({
      method: "GET",
      url: `/api/v1/premises/${premisesId}/cameras`,
      headers: {
        "x-tenant-id": "tenant-cameras",
        "x-user-id": "user-cameras"
      }
    });

    expect(listCameraResponse.statusCode).toBe(200);
    expect(listCameraResponse.json().items).toHaveLength(1);
    expect(listCameraResponse.json().items[0].id).toBe(cameraId);

    const updateCameraResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/premises/${premisesId}/cameras/${cameraId}`,
      headers: {
        "x-tenant-id": "tenant-cameras",
        "x-user-id": "user-cameras"
      },
      payload: {
        status: "offline",
        locationDescription: "Maintenance bay"
      }
    });

    expect(updateCameraResponse.statusCode).toBe(200);
    expect(updateCameraResponse.json().camera).toMatchObject({
      id: cameraId,
      status: "offline",
      locationDescription: "Maintenance bay"
    });

    const otherTenantCameraLookup = await app.inject({
      method: "GET",
      url: `/api/v1/premises/${premisesId}/cameras/${cameraId}`,
      headers: {
        "x-tenant-id": "tenant-other",
        "x-user-id": "user-other"
      }
    });

    expect(otherTenantCameraLookup.statusCode).toBe(404);

    const deleteCameraResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/premises/${premisesId}/cameras/${cameraId}`,
      headers: {
        "x-tenant-id": "tenant-cameras",
        "x-user-id": "user-cameras"
      }
    });

    expect(deleteCameraResponse.statusCode).toBe(204);
  });

  it("rejects protected CRUD requests when tenant context is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/premises"
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "Unauthorized",
      message: "Tenant context is required for this resource."
    });
  });

  it("creates, lists, updates, and deletes tenant-scoped agents", async () => {
    const premisesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-agents",
        "x-user-id": "user-agents"
      },
      payload: {
        name: "Dock Office",
        type: "office",
        addressLine1: "14 Harbor Lane",
        city: "Marseille",
        postalCode: "13002",
        countryCode: "FR"
      }
    });

    const premisesId = premisesResponse.json().premises.id as string;

    const createAgentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: {
        "x-tenant-id": "tenant-agents",
        "x-user-id": "user-agents"
      },
      payload: {
        premisesId,
        name: "Edge Agent 01",
        status: "online",
        softwareVersion: "1.2.0",
        locationDescription: "Server rack A",
        hostName: "edge-agent-01"
      }
    });

    expect(createAgentResponse.statusCode).toBe(201);
    expect(createAgentResponse.json().agent).toMatchObject({
      tenantId: "tenant-agents",
      premisesId,
      name: "Edge Agent 01",
      status: "online",
      softwareVersion: "1.2.0"
    });

    const agentId = createAgentResponse.json().agent.id as string;

    const listAgentsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/agents",
      headers: {
        "x-tenant-id": "tenant-agents"
      }
    });

    expect(listAgentsResponse.statusCode).toBe(200);
    expect(listAgentsResponse.json().items).toHaveLength(1);
    expect(listAgentsResponse.json().items[0].id).toBe(agentId);

    const updateAgentResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/agents/${agentId}`,
      headers: {
        "x-tenant-id": "tenant-agents",
        "x-user-id": "user-agents"
      },
      payload: {
        status: "maintenance",
        softwareVersion: "1.2.1"
      }
    });

    expect(updateAgentResponse.statusCode).toBe(200);
    expect(updateAgentResponse.json().agent).toMatchObject({
      id: agentId,
      status: "maintenance",
      softwareVersion: "1.2.1"
    });

    const deleteAgentResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/agents/${agentId}`,
      headers: {
        "x-tenant-id": "tenant-agents",
        "x-user-id": "user-agents"
      }
    });

    expect(deleteAgentResponse.statusCode).toBe(204);
  });

  it("accepts agent camera health reports and updates the camera status snapshot", async () => {
    const premisesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-health",
        "x-user-id": "user-health"
      },
      payload: {
        name: "Health Site",
        type: "factory",
        addressLine1: "22 Mill Road",
        city: "Lille",
        postalCode: "59000",
        countryCode: "FR"
      }
    });

    const premisesId = premisesResponse.json().premises.id as string;

    const cameraResponse = await app.inject({
      method: "POST",
      url: `/api/v1/premises/${premisesId}/cameras`,
      headers: {
        "x-tenant-id": "tenant-health",
        "x-user-id": "user-health"
      },
      payload: {
        name: "Boiler Camera",
        streamUrl: "rtsp://camera.local/boiler"
      }
    });

    const cameraId = cameraResponse.json().camera.id as string;

    const agentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: {
        "x-tenant-id": "tenant-health",
        "x-user-id": "user-health"
      },
      payload: {
        premisesId,
        name: "Boiler Agent",
        status: "online"
      }
    });

    const agentId = agentResponse.json().agent.id as string;

    const healthResponse = await app.inject({
      method: "POST",
      url: `/api/v1/agents/${agentId}/camera-health`,
      headers: {
        "x-tenant-id": "tenant-health"
      },
      payload: {
        cameraId,
        status: "degraded",
        temperatureCelsius: 66.4,
        uptimeSeconds: 7200,
        ipAddress: "192.168.1.20",
        reportedAt: "2026-04-02T10:00:00.000Z"
      }
    });

    expect(healthResponse.statusCode).toBe(202);
    expect(healthResponse.json().healthReport).toMatchObject({
      agentId,
      cameraId,
      status: "degraded",
      ipAddress: "192.168.1.20",
      uptimeSeconds: 7200
    });

    const cameraLookupResponse = await app.inject({
      method: "GET",
      url: `/api/v1/premises/${premisesId}/cameras/${cameraId}`,
      headers: {
        "x-tenant-id": "tenant-health"
      }
    });

    expect(cameraLookupResponse.statusCode).toBe(200);
    expect(cameraLookupResponse.json().camera.status).toBe("degraded");
  });

  it("accepts multiple frames from an agent, stores files on disk, and records metadata", async () => {
    const premisesResponse = await app.inject({
      method: "POST",
      url: "/api/v1/premises",
      headers: {
        "x-tenant-id": "tenant-frames",
        "x-user-id": "user-frames"
      },
      payload: {
        name: "Frame Site",
        type: "warehouse",
        addressLine1: "8 Cargo Route",
        city: "Le Havre",
        postalCode: "76600",
        countryCode: "FR"
      }
    });

    const premisesId = premisesResponse.json().premises.id as string;

    const cameraResponse = await app.inject({
      method: "POST",
      url: `/api/v1/premises/${premisesId}/cameras`,
      headers: {
        "x-tenant-id": "tenant-frames",
        "x-user-id": "user-frames"
      },
      payload: {
        name: "Yard Camera",
        streamUrl: "rtsp://camera.local/yard"
      }
    });

    const cameraId = cameraResponse.json().camera.id as string;

    const agentResponse = await app.inject({
      method: "POST",
      url: "/api/v1/agents",
      headers: {
        "x-tenant-id": "tenant-frames",
        "x-user-id": "user-frames"
      },
      payload: {
        premisesId,
        name: "Yard Agent",
        status: "online"
      }
    });

    const agentId = agentResponse.json().agent.id as string;

    const framesResponse = await app.inject({
      method: "POST",
      url: `/api/v1/agents/${agentId}/frames`,
      headers: {
        "x-tenant-id": "tenant-frames"
      },
      payload: {
        frames: [
          {
            cameraId,
            timestamp: "2026-04-02T10:15:00.000Z",
            contentType: "image/jpeg",
            dataBase64: Buffer.from("frame-one").toString("base64")
          },
          {
            cameraId,
            timestamp: "2026-04-02T10:15:01.000Z",
            contentType: "image/jpeg",
            dataBase64: Buffer.from("frame-two").toString("base64")
          }
        ]
      }
    });

    expect(framesResponse.statusCode).toBe(202);
    expect(framesResponse.json().items).toHaveLength(2);
    expect(framesResponse.json().items[0]).toMatchObject({
      agentId,
      cameraId,
      contentType: "image/jpeg"
    });

    const storageRoot = await storageRootPromise;
    const tenantDirectory = path.join(storageRoot, "tenant-frames", "frames");
    const storedFiles = await readdir(tenantDirectory, { recursive: true });

    expect(storedFiles.filter((entry) => String(entry).endsWith(".jpg"))).toHaveLength(2);

    const firstStoragePath = framesResponse.json().items[0].storagePath as string;
    const firstFile = await readFile(path.join(storageRoot, firstStoragePath), "utf8");
    expect(firstFile).toBe("frame-one");
  });
});
