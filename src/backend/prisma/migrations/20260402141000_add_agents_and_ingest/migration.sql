-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM (
  'ONLINE',
  'OFFLINE',
  'MAINTENANCE'
);

-- CreateTable
CREATE TABLE "Agent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "premisesId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
  "softwareVersion" TEXT,
  "locationDescription" TEXT,
  "hostName" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraHealthReport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "status" "CameraStatus" NOT NULL,
  "temperatureCelsius" DOUBLE PRECISION,
  "uptimeSeconds" INTEGER,
  "ipAddress" TEXT,
  "reportedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CameraHealthReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraFrame" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "cameraId" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CameraFrame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Agent_tenantId_idx" ON "Agent"("tenantId");

-- CreateIndex
CREATE INDEX "Agent_tenantId_premisesId_idx" ON "Agent"("tenantId", "premisesId");

-- CreateIndex
CREATE INDEX "CameraHealthReport_tenantId_agentId_idx" ON "CameraHealthReport"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "CameraHealthReport_tenantId_cameraId_reportedAt_idx" ON "CameraHealthReport"("tenantId", "cameraId", "reportedAt");

-- CreateIndex
CREATE INDEX "CameraFrame_tenantId_agentId_idx" ON "CameraFrame"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "CameraFrame_tenantId_cameraId_capturedAt_idx" ON "CameraFrame"("tenantId", "cameraId", "capturedAt");

-- AddForeignKey
ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_premisesId_fkey"
FOREIGN KEY ("premisesId")
REFERENCES "Premises"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent"
ADD CONSTRAINT "Agent_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraHealthReport"
ADD CONSTRAINT "CameraHealthReport_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraHealthReport"
ADD CONSTRAINT "CameraHealthReport_agentId_fkey"
FOREIGN KEY ("agentId")
REFERENCES "Agent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraHealthReport"
ADD CONSTRAINT "CameraHealthReport_cameraId_fkey"
FOREIGN KEY ("cameraId")
REFERENCES "Camera"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraFrame"
ADD CONSTRAINT "CameraFrame_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraFrame"
ADD CONSTRAINT "CameraFrame_agentId_fkey"
FOREIGN KEY ("agentId")
REFERENCES "Agent"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraFrame"
ADD CONSTRAINT "CameraFrame_cameraId_fkey"
FOREIGN KEY ("cameraId")
REFERENCES "Camera"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
