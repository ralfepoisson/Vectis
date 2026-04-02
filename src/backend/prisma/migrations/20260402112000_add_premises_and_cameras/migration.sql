-- CreateEnum
CREATE TYPE "PremisesType" AS ENUM (
  'HOUSE',
  'APARTMENT',
  'OFFICE',
  'FACTORY',
  'WAREHOUSE',
  'RETAIL',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM (
  'ONLINE',
  'DEGRADED',
  'OFFLINE',
  'MAINTENANCE'
);

-- CreateTable
CREATE TABLE "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "displayName" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Premises" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" "PremisesType" NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "addressLine2" TEXT,
  "city" TEXT NOT NULL,
  "state" TEXT,
  "postalCode" TEXT,
  "countryCode" TEXT NOT NULL,
  "notes" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Premises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "premisesId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "streamUrl" TEXT NOT NULL,
  "status" "CameraStatus" NOT NULL DEFAULT 'OFFLINE',
  "model" TEXT,
  "serialNumber" TEXT,
  "locationDescription" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Premises_tenantId_idx" ON "Premises"("tenantId");

-- CreateIndex
CREATE INDEX "Camera_tenantId_idx" ON "Camera"("tenantId");

-- CreateIndex
CREATE INDEX "Camera_tenantId_premisesId_idx" ON "Camera"("tenantId", "premisesId");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premises"
ADD CONSTRAINT "Premises_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premises"
ADD CONSTRAINT "Premises_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premises"
ADD CONSTRAINT "Premises_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera"
ADD CONSTRAINT "Camera_tenantId_fkey"
FOREIGN KEY ("tenantId")
REFERENCES "Tenant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera"
ADD CONSTRAINT "Camera_premisesId_fkey"
FOREIGN KEY ("premisesId")
REFERENCES "Premises"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera"
ADD CONSTRAINT "Camera_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId")
REFERENCES "User"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Camera"
ADD CONSTRAINT "Camera_updatedByUserId_fkey"
FOREIGN KEY ("updatedByUserId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
