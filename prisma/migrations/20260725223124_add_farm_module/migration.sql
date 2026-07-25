-- CreateEnum
CREATE TYPE "VehicleLogType" AS ENUM ('MAINTENANCE', 'FUEL');

-- CreateEnum
CREATE TYPE "SiloMovementType" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "LivestockEventType" AS ENUM ('WEIGHING', 'HEALTH', 'MOVEMENT');

-- CreateTable
CREATE TABLE "Harvest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Harvest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'HECTARE',
    "currentCrop" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANTED',
    "harvestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilAnalysis" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "ph" DECIMAL(4,2),
    "phosphorus" DECIMAL(8,2),
    "potassium" DECIMAL(8,2),
    "organicMatter" DECIMAL(5,2),
    "recommendation" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoilAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlotApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "harvestId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(12,2),
    "date" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlotApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "plate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "currentReading" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "VehicleLogType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "odometerOrHours" DECIMAL(12,2),
    "employeeId" TEXT,
    "notes" TEXT,
    "liters" DECIMAL(10,2),
    "fuelCost" DECIMAL(12,2),
    "description" TEXT,
    "maintenanceCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "harvestId" TEXT,
    "siloName" TEXT NOT NULL,
    "grainType" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'TON',
    "pricePerUnit" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Silo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DECIMAL(12,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'TON',
    "currentStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Silo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiloMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "siloId" TEXT NOT NULL,
    "type" "SiloMovementType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "harvestId" TEXT,
    "contractId" TEXT,
    "moisture" DECIMAL(5,2),
    "qualityGrade" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiloMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "averageWeight" DECIMAL(8,2),
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivestockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LivestockEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" "LivestockEventType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weight" DECIMAL(8,2),
    "location" TEXT,
    "description" TEXT,
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LivestockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT,
    "certificateNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scope" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrrigationEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "durationHours" DECIMAL(6,2),
    "flowRate" DECIMAL(10,2),
    "volumeApplied" DECIMAL(10,2),
    "employeeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IrrigationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Harvest_tenantId_idx" ON "Harvest"("tenantId");

-- CreateIndex
CREATE INDEX "Plot_tenantId_idx" ON "Plot"("tenantId");

-- CreateIndex
CREATE INDEX "Plot_harvestId_idx" ON "Plot"("harvestId");

-- CreateIndex
CREATE INDEX "SoilAnalysis_tenantId_idx" ON "SoilAnalysis"("tenantId");

-- CreateIndex
CREATE INDEX "SoilAnalysis_plotId_idx" ON "SoilAnalysis"("plotId");

-- CreateIndex
CREATE INDEX "PlotApplication_tenantId_idx" ON "PlotApplication"("tenantId");

-- CreateIndex
CREATE INDEX "PlotApplication_plotId_idx" ON "PlotApplication"("plotId");

-- CreateIndex
CREATE INDEX "Vehicle_tenantId_idx" ON "Vehicle"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleLog_tenantId_idx" ON "VehicleLog"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleLog_vehicleId_idx" ON "VehicleLog"("vehicleId");

-- CreateIndex
CREATE INDEX "Employee_tenantId_idx" ON "Employee"("tenantId");

-- CreateIndex
CREATE INDEX "Contract_tenantId_idx" ON "Contract"("tenantId");

-- CreateIndex
CREATE INDEX "Contract_harvestId_idx" ON "Contract"("harvestId");

-- CreateIndex
CREATE INDEX "Silo_tenantId_idx" ON "Silo"("tenantId");

-- CreateIndex
CREATE INDEX "SiloMovement_tenantId_idx" ON "SiloMovement"("tenantId");

-- CreateIndex
CREATE INDEX "SiloMovement_siloId_idx" ON "SiloMovement"("siloId");

-- CreateIndex
CREATE INDEX "LivestockBatch_tenantId_idx" ON "LivestockBatch"("tenantId");

-- CreateIndex
CREATE INDEX "LivestockEvent_tenantId_idx" ON "LivestockEvent"("tenantId");

-- CreateIndex
CREATE INDEX "LivestockEvent_batchId_idx" ON "LivestockEvent"("batchId");

-- CreateIndex
CREATE INDEX "Certification_tenantId_idx" ON "Certification"("tenantId");

-- CreateIndex
CREATE INDEX "IrrigationEvent_tenantId_idx" ON "IrrigationEvent"("tenantId");

-- CreateIndex
CREATE INDEX "IrrigationEvent_plotId_idx" ON "IrrigationEvent"("plotId");

-- AddForeignKey
ALTER TABLE "Harvest" ADD CONSTRAINT "Harvest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilAnalysis" ADD CONSTRAINT "SoilAnalysis_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotApplication" ADD CONSTRAINT "PlotApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotApplication" ADD CONSTRAINT "PlotApplication_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotApplication" ADD CONSTRAINT "PlotApplication_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotApplication" ADD CONSTRAINT "PlotApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlotApplication" ADD CONSTRAINT "PlotApplication_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleLog" ADD CONSTRAINT "VehicleLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Silo" ADD CONSTRAINT "Silo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloMovement" ADD CONSTRAINT "SiloMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloMovement" ADD CONSTRAINT "SiloMovement_siloId_fkey" FOREIGN KEY ("siloId") REFERENCES "Silo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloMovement" ADD CONSTRAINT "SiloMovement_harvestId_fkey" FOREIGN KEY ("harvestId") REFERENCES "Harvest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiloMovement" ADD CONSTRAINT "SiloMovement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockBatch" ADD CONSTRAINT "LivestockBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockEvent" ADD CONSTRAINT "LivestockEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockEvent" ADD CONSTRAINT "LivestockEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "LivestockBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LivestockEvent" ADD CONSTRAINT "LivestockEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrrigationEvent" ADD CONSTRAINT "IrrigationEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
