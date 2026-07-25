-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY['store']::TEXT[];
