BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'Role'
      AND t.typtype = 'e'
  ) THEN
    ALTER TYPE "Role" RENAME TO "LegacyRole";
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'ENTERPRISE',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "tenantId" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Location" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "pincode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Unit" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "logoUrl" TEXT,
  "shortName" TEXT,
  "unitType" TEXT,
  "locationId" TEXT NOT NULL,
  "address" TEXT,
  "pincode" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_code_key" ON "Tenant"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_tenantId_key" ON "Role"("name", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "Unit_code_key" ON "Unit"("code");

INSERT INTO "Tenant" ("id", "name", "code", "plan", "isActive", "isDeleted", "createdAt", "updatedAt")
VALUES ('fc75cbca-5a45-46e9-9905-521d708e5ebe', 'Universal ERP', 'DEFAULT', 'ENTERPRISE', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "plan" = EXCLUDED."plan",
  "isActive" = EXCLUDED."isActive",
  "isDeleted" = EXCLUDED."isDeleted",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Location" ("id", "name", "state", "country", "pincode", "createdAt")
VALUES ('default-location', 'Default Location', 'Default', 'India', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "state" = EXCLUDED."state",
  "country" = EXCLUDED."country";

INSERT INTO "Unit" ("id", "name", "code", "locationId", "status", "tenantId", "isDeleted", "createdAt", "updatedAt")
VALUES ('f7dab772-a5b3-404f-80bc-c5a4f5f03405', 'Default Unit', 'DEFAULT', 'default-location', true, 'fc75cbca-5a45-46e9-9905-521d708e5ebe', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "locationId" = EXCLUDED."locationId",
  "status" = EXCLUDED."status",
  "tenantId" = EXCLUDED."tenantId",
  "isDeleted" = EXCLUDED."isDeleted",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Role" ("id", "name", "description", "tenantId", "isDeleted", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin', 'Default administrator role', 'fc75cbca-5a45-46e9-9905-521d708e5ebe', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "tenantId" = EXCLUDED."tenantId",
  "isDeleted" = EXCLUDED."isDeleted",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "User"
SET
  "firstName" = COALESCE(NULLIF("firstName", ''), NULLIF(initcap(regexp_replace(split_part(COALESCE("email", ''), '@', 1), '[^[:alnum:]]+', ' ', 'g')), ''), 'Admin'),
  "lastName" = COALESCE("lastName", ''),
  "roleId" = COALESCE("roleId", '00000000-0000-0000-0000-000000000001'),
  "tenantId" = COALESCE("tenantId", 'fc75cbca-5a45-46e9-9905-521d708e5ebe'),
  "unitId" = COALESCE("unitId", 'f7dab772-a5b3-404f-80bc-c5a4f5f03405'),
  "isActive" = COALESCE("isActive", true),
  "isDeleted" = COALESCE("isDeleted", false),
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "isActive" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "isActive" SET DEFAULT true;
ALTER TABLE "User" ALTER COLUMN "isDeleted" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "isDeleted" SET DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId");
CREATE INDEX IF NOT EXISTS "User_unitId_idx" ON "User"("unitId");

COMMIT;
