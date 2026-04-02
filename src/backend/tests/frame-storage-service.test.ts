import { PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  LocalFrameStorageService,
  S3FrameStorageService,
  createFrameStorageFromEnv
} from "../src/services/frame-storage-service";

describe("frame storage services", () => {
  it("creates an S3-backed storage service from environment configuration", async () => {
    const send = vi.fn().mockResolvedValue({});
    const service = createFrameStorageFromEnv({
      defaultLocalPath: "/tmp/vectis-storage",
      env: {
        FRAME_STORAGE_DRIVER: "s3",
        FRAME_STORAGE_S3_BUCKET: "vectis-images",
        FRAME_STORAGE_S3_PREFIX: "captures"
      },
      s3Client: { send }
    });

    const stored = await service.storeFrame({
      tenantId: "tenant-alpha",
      agentId: "agent-1",
      cameraId: "camera-1",
      capturedAt: "2026-04-02T12:30:00.000Z",
      contentType: "image/jpeg",
      dataBase64: Buffer.from("frame-data").toString("base64")
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: "vectis-images",
      ContentType: "image/jpeg",
      Key: expect.stringMatching(
        /^captures\/tenant-alpha\/frames\/agent-1\/camera-1\/2026\/04\/02\/.+\.jpg$/
      )
    });
    expect(stored.byteSize).toBe("frame-data".length);
    expect(stored.storagePath).toMatch(
      /^captures\/tenant-alpha\/frames\/agent-1\/camera-1\/2026\/04\/02\/.+\.jpg$/
    );
  });

  it("falls back to local storage when no production storage driver is configured", () => {
    const service = createFrameStorageFromEnv({
      defaultLocalPath: "/tmp/vectis-storage",
      env: {}
    });

    expect(service).toBeInstanceOf(LocalFrameStorageService);
  });

  it("uploads to S3 with the provided bucket and prefix", async () => {
    const send = vi.fn().mockResolvedValue({});
    const service = new S3FrameStorageService({ send }, "vectis-images", "raw");

    const stored = await service.storeFrame({
      tenantId: "tenant-bravo",
      agentId: "agent-2",
      cameraId: "camera-9",
      capturedAt: "2026-04-02T12:31:00.000Z",
      contentType: "image/png",
      dataBase64: Buffer.from("png-data").toString("base64")
    });

    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: "vectis-images",
      ContentType: "image/png",
      Key: expect.stringMatching(/^raw\/tenant-bravo\/frames\/agent-2\/camera-9\/2026\/04\/02\/.+\.png$/)
    });
    expect(stored.storagePath).toMatch(
      /^raw\/tenant-bravo\/frames\/agent-2\/camera-9\/2026\/04\/02\/.+\.png$/
    );
  });
});
