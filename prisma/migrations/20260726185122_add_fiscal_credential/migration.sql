-- CreateTable
CREATE TABLE "FiscalCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificateCipher" TEXT NOT NULL,
    "certificateIv" TEXT NOT NULL,
    "certificateTag" TEXT NOT NULL,
    "passCipher" TEXT NOT NULL,
    "passIv" TEXT NOT NULL,
    "passTag" TEXT NOT NULL,
    "fileName" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "environment" TEXT NOT NULL DEFAULT 'test',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalCredential_tenantId_idx" ON "FiscalCredential"("tenantId");

-- CreateIndex
CREATE INDEX "FiscalCredential_tenantId_isActive_idx" ON "FiscalCredential"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "FiscalCredential" ADD CONSTRAINT "FiscalCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

