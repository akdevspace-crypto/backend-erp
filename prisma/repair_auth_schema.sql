BEGIN;

-- The previous database used an enum named "Role"; this app uses a "Role" table.
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE TEXT USING "role"::text;
ALTER TABLE "User" ALTER COLUMN "role" DROP NOT NULL;

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

ALTER TABLE "Agent" DROP CONSTRAINT IF EXISTS "Agent_userId_fkey";
ALTER TABLE "Agent" ALTER COLUMN "userId" TYPE TEXT USING "userId"::text;
ALTER TABLE "User" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
ALTER TABLE "Agent"
  ADD CONSTRAINT "Agent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON UPDATE CASCADE ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'FREE',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_code_key" ON "Tenant"("code");

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" JSONB,
  "tenantId" TEXT,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_tenantId_key" ON "Role"("name", "tenantId");
CREATE INDEX IF NOT EXISTS "Role_tenantId_idx" ON "Role"("tenantId");

CREATE TABLE IF NOT EXISTS "Unit" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "status" BOOLEAN NOT NULL DEFAULT true,
  "tenantId" TEXT NOT NULL,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Unit_code_key" ON "Unit"("code");
CREATE INDEX IF NOT EXISTS "Unit_tenantId_idx" ON "Unit"("tenantId");
CREATE INDEX IF NOT EXISTS "Unit_locationId_idx" ON "Unit"("locationId");

CREATE TABLE IF NOT EXISTS "Staff" (
  "id" TEXT NOT NULL,
  "empId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT,
  "department" TEXT,
  "departmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "designation" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "availabilityStatus" TEXT NOT NULL DEFAULT 'Available',
  "currentWorkload" INTEGER NOT NULL DEFAULT 0,
  "maxWorkload" INTEGER NOT NULL DEFAULT 5,
  "userId" TEXT,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "documents" JSONB,
  "metadata" JSONB,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Staff_empId_key" ON "Staff"("empId");
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_key" ON "Staff"("userId");
CREATE INDEX IF NOT EXISTS "Staff_tenantId_idx" ON "Staff"("tenantId");
CREATE INDEX IF NOT EXISTS "Staff_unitId_idx" ON "Staff"("unitId");

ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "shortName" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "unitType" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "pincode" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Unit" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "joiningDate" TIMESTAMP(3);
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "workload" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "shiftStart" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "shiftEnd" TEXT;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "capacity" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "stressLevel" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unitId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

INSERT INTO "Tenant" ("id", "name", "code", "plan", "isActive", "isDeleted", "createdAt", "updatedAt")
VALUES ('fc75cbca-5a45-46e9-9905-521d708e5ebe', 'Universal ERP', 'DEFAULT', 'ENTERPRISE', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "code" = EXCLUDED."code",
  "plan" = EXCLUDED."plan",
  "isActive" = EXCLUDED."isActive",
  "isDeleted" = EXCLUDED."isDeleted",
  "updatedAt" = CURRENT_TIMESTAMP;

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

INSERT INTO "Role" ("id", "name", "description", "permissions", "tenantId", "isDeleted", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin', 'Default administrator role', NULL, 'fc75cbca-5a45-46e9-9905-521d708e5ebe', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "permissions" = EXCLUDED."permissions",
  "tenantId" = EXCLUDED."tenantId",
  "isDeleted" = EXCLUDED."isDeleted",
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "User"
SET
  "firstName" = COALESCE(NULLIF("firstName", ''), NULLIF(initcap(regexp_replace(split_part("email", '@', 1), '[^[:alnum:]]+', ' ', 'g')), ''), 'Admin'),
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
