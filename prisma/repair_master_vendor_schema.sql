CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "Vendor" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "contact" TEXT,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_code_key" ON "Vendor"("code");
CREATE INDEX IF NOT EXISTS "Vendor_tenantId_idx" ON "Vendor"("tenantId");
CREATE INDEX IF NOT EXISTS "Vendor_unitId_idx" ON "Vendor"("unitId");
