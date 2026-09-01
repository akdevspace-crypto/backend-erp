BEGIN;

CREATE TABLE IF NOT EXISTS "AccountTransaction" (
  "id" TEXT NOT NULL,
  "refNo" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CREATED',
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "allocationId" TEXT;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "paymentMode" TEXT;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "clientName" TEXT;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AccountTransaction" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountTransaction_refNo_key" ON "AccountTransaction"("refNo");
CREATE INDEX IF NOT EXISTS "AccountTransaction_tenantId_idx" ON "AccountTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_unitId_idx" ON "AccountTransaction"("unitId");
CREATE INDEX IF NOT EXISTS "AccountTransaction_status_idx" ON "AccountTransaction"("status");
CREATE INDEX IF NOT EXISTS "AccountTransaction_type_idx" ON "AccountTransaction"("type");
CREATE INDEX IF NOT EXISTS "AccountTransaction_allocationId_idx" ON "AccountTransaction"("allocationId");

CREATE TABLE IF NOT EXISTS "RefCounter" (
  "id" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "current" INTEGER NOT NULL DEFAULT 0,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  CONSTRAINT "RefCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefCounter_prefix_tenantId_key" ON "RefCounter"("prefix", "tenantId");

COMMIT;
