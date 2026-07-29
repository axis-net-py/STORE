-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'FAILED', 'MIGRATION_FAILED');

-- CreateEnum
CREATE TYPE "TenantHosting" AS ENUM ('SHARED', 'DEDICATED');

-- CreateTable
CREATE TABLE "TenantRegistry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hosting" "TenantHosting" NOT NULL DEFAULT 'SHARED',
    "status" "TenantStatus" NOT NULL DEFAULT 'PROVISIONING',
    "neonProjectId" TEXT,
    "connectionCipher" TEXT,
    "connectionIv" TEXT,
    "connectionTag" TEXT,
    "vertical" TEXT NOT NULL DEFAULT 'store',
    "modules" TEXT[] DEFAULT ARRAY['store']::TEXT[],
    "schemaVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvisioningEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "detalhe" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProvisioningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantRegistry_slug_key" ON "TenantRegistry"("slug");

-- CreateIndex
CREATE INDEX "TenantRegistry_status_idx" ON "TenantRegistry"("status");

-- CreateIndex
CREATE INDEX "TenantRegistry_hosting_idx" ON "TenantRegistry"("hosting");

-- CreateIndex
CREATE INDEX "ProvisioningEvent_tenantId_createdAt_idx" ON "ProvisioningEvent"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProvisioningEvent" ADD CONSTRAINT "ProvisioningEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "TenantRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

