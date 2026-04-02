import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client, type PutObjectCommandInput } from "@aws-sdk/client-s3";

export interface StoreFrameInput {
  tenantId: string;
  agentId: string;
  cameraId: string;
  capturedAt: string;
  contentType: "image/jpeg" | "image/png";
  dataBase64: string;
}

export interface StoredFrame {
  byteSize: number;
  storagePath: string;
}

export interface FrameStorageService {
  storeFrame(input: StoreFrameInput): Promise<StoredFrame>;
}

export class LocalFrameStorageService implements FrameStorageService {
  constructor(private readonly storageRoot: string) {}

  async storeFrame(input: StoreFrameInput) {
    const storagePath = buildStoragePath(input);
    const absoluteDirectory = path.join(this.storageRoot, path.dirname(storagePath));
    const absolutePath = path.join(this.storageRoot, storagePath);
    const buffer = Buffer.from(input.dataBase64, "base64");

    await mkdir(absoluteDirectory, { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      byteSize: buffer.byteLength,
      storagePath
    };
  }
}

export interface S3LikeClient {
  send(command: PutObjectCommand): Promise<unknown>;
}

export class S3FrameStorageService implements FrameStorageService {
  constructor(
    private readonly client: S3LikeClient,
    private readonly bucket: string,
    private readonly keyPrefix = "raw"
  ) {}

  async storeFrame(input: StoreFrameInput) {
    const storagePath = joinStorageSegments(this.keyPrefix, buildStoragePath(input));
    const buffer = Buffer.from(input.dataBase64, "base64");
    const putObjectInput: PutObjectCommandInput = {
      Body: buffer,
      Bucket: this.bucket,
      ContentType: input.contentType,
      Key: storagePath
    };

    await this.client.send(new PutObjectCommand(putObjectInput));

    return {
      byteSize: buffer.byteLength,
      storagePath
    };
  }
}

export interface FrameStorageFromEnvOptions {
  defaultLocalPath: string;
  env?: NodeJS.ProcessEnv;
  s3Client?: S3LikeClient;
}

export function createFrameStorageFromEnv(options: FrameStorageFromEnvOptions): FrameStorageService {
  const env = options.env ?? process.env;
  const driver = env.FRAME_STORAGE_DRIVER ?? "local";

  if (driver === "s3") {
    const bucket = env.FRAME_STORAGE_S3_BUCKET;

    if (!bucket) {
      throw new Error("FRAME_STORAGE_S3_BUCKET is required when FRAME_STORAGE_DRIVER is set to s3.");
    }

    return new S3FrameStorageService(
      options.s3Client ?? new S3Client({ region: env.AWS_REGION }),
      bucket,
      env.FRAME_STORAGE_S3_PREFIX ?? "raw"
    );
  }

  return new LocalFrameStorageService(options.defaultLocalPath);
}

function buildStoragePath(input: StoreFrameInput) {
  const timestamp = new Date(input.capturedAt);
  const extension = input.contentType === "image/png" ? "png" : "jpg";
  const fileName = `${timestamp.getTime()}-${Math.random().toString(16).slice(2, 10)}.${extension}`;

  return joinStorageSegments(
    input.tenantId,
    "frames",
    input.agentId,
    input.cameraId,
    String(timestamp.getUTCFullYear()),
    String(timestamp.getUTCMonth() + 1).padStart(2, "0"),
    String(timestamp.getUTCDate()).padStart(2, "0"),
    fileName
  );
}

function joinStorageSegments(...segments: string[]) {
  return segments.join("/");
}
