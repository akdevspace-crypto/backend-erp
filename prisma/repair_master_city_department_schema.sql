CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "City" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "City_tenantId_idx" ON "City"("tenantId");
CREATE INDEX IF NOT EXISTS "City_unitId_idx" ON "City"("unitId");
CREATE UNIQUE INDEX IF NOT EXISTS "City_name_state_country_tenantId_unitId_key"
  ON "City"("name", "state", "country", "tenantId", "unitId");

CREATE TABLE IF NOT EXISTS "Department" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "head" TEXT,
  "totalStaff" INTEGER NOT NULL DEFAULT 0,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");
CREATE INDEX IF NOT EXISTS "Department_tenantId_idx" ON "Department"("tenantId");
CREATE INDEX IF NOT EXISTS "Department_unitId_idx" ON "Department"("unitId");
