CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "Room" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Room_code_key" ON "Room"("code");
CREATE INDEX IF NOT EXISTS "Room_tenantId_idx" ON "Room"("tenantId");
CREATE INDEX IF NOT EXISTS "Room_unitId_idx" ON "Room"("unitId");
