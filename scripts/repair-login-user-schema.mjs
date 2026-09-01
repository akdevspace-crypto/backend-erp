import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

const DEFAULT_TENANT_ID = 'fc75cbca-5a45-46e9-9905-521d708e5ebe';
const DEFAULT_UNIT_ID = 'f7dab772-a5b3-404f-80bc-c5a4f5f03405';
const DEFAULT_LOCATION_ID = 'default-location';
const DEFAULT_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const columnRows = async (tableName) => prisma.$queryRaw`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = ${tableName}
`;

const hasColumn = async (tableName, columnName) => {
  const rows = await columnRows(tableName);
  return rows.some((row) => row.column_name === columnName);
};

const tableExists = async (tableName) => {
  const rows = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;
  return rows.length > 0;
};

const apply = async (label, sql) => {
  await prisma.$executeRawUnsafe(sql);
  console.log(`[ok] ${label}`);
};

try {
  if (!(await tableExists('User'))) {
    throw new Error('Cannot repair login schema because public."User" table does not exist.');
  }

  await apply('legacy Role enum guard', `
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
    END $$
  `);

  await apply('Tenant table', `
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
    )
  `);

  await apply('Location table', `
    CREATE TABLE IF NOT EXISTS "Location" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "state" TEXT NOT NULL,
      "country" TEXT NOT NULL,
      "pincode" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
    )
  `);

  await apply('Unit table', `
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
    )
  `);

  await apply('Role table', `
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
    )
  `);

  const userColumnDefinitions = [
    ['firstName', 'TEXT'],
    ['lastName', 'TEXT'],
    ['mobile', 'TEXT'],
    ['roleId', 'TEXT'],
    ['tenantId', 'TEXT'],
    ['unitId', 'TEXT'],
    ['isActive', 'BOOLEAN'],
    ['isDeleted', 'BOOLEAN'],
    ['deletedAt', 'TIMESTAMP(3)']
  ];

  for (const [columnName, definition] of userColumnDefinitions) {
    await apply(`User.${columnName} column`, `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "${columnName}" ${definition}`);
  }

  const userHasName = await hasColumn('User', 'name');
  const nameExpression = userHasName
    ? `NULLIF(trim("name"), '')`
    : `NULLIF(initcap(regexp_replace(split_part(COALESCE("email", ''), '@', 1), '[^[:alnum:]]+', ' ', 'g')), '')`;

  await apply('base indexes', `
    CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_code_key" ON "Tenant"("code")
  `);
  await apply('role tenant index', `
    CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_tenantId_key" ON "Role"("name", "tenantId")
  `);
  await apply('unit code index', `
    CREATE UNIQUE INDEX IF NOT EXISTS "Unit_code_key" ON "Unit"("code")
  `);

  await apply('default tenant seed', `
    INSERT INTO "Tenant" ("id", "name", "code", "plan", "isActive", "isDeleted", "createdAt", "updatedAt")
    VALUES ('${DEFAULT_TENANT_ID}', 'Universal ERP', 'DEFAULT', 'ENTERPRISE', true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "code" = EXCLUDED."code",
      "plan" = EXCLUDED."plan",
      "isActive" = EXCLUDED."isActive",
      "isDeleted" = EXCLUDED."isDeleted",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  await apply('default location seed', `
    INSERT INTO "Location" ("id", "name", "state", "country", "pincode", "createdAt")
    VALUES ('${DEFAULT_LOCATION_ID}', 'Default Location', 'Default State', 'India', NULL, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "state" = EXCLUDED."state",
      "country" = EXCLUDED."country"
  `);

  await apply('default unit seed', `
    INSERT INTO "Unit" ("id", "name", "code", "locationId", "status", "tenantId", "isDeleted", "createdAt", "updatedAt")
    VALUES ('${DEFAULT_UNIT_ID}', 'Default Unit', 'DEFAULT', '${DEFAULT_LOCATION_ID}', true, '${DEFAULT_TENANT_ID}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "code" = EXCLUDED."code",
      "locationId" = EXCLUDED."locationId",
      "status" = EXCLUDED."status",
      "tenantId" = EXCLUDED."tenantId",
      "isDeleted" = EXCLUDED."isDeleted",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  await apply('default role seed', `
    INSERT INTO "Role" ("id", "name", "description", "tenantId", "isDeleted", "createdAt", "updatedAt")
    VALUES ('${DEFAULT_ROLE_ID}', 'Admin', 'Default administrator role', '${DEFAULT_TENANT_ID}', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO UPDATE SET
      "name" = EXCLUDED."name",
      "description" = EXCLUDED."description",
      "tenantId" = EXCLUDED."tenantId",
      "isDeleted" = EXCLUDED."isDeleted",
      "updatedAt" = CURRENT_TIMESTAMP
  `);

  await apply('User login values backfill', `
    UPDATE "User"
    SET
      "firstName" = COALESCE(NULLIF("firstName", ''), ${nameExpression}, 'Admin'),
      "lastName" = COALESCE("lastName", ''),
      "roleId" = COALESCE("roleId", '${DEFAULT_ROLE_ID}'),
      "tenantId" = COALESCE("tenantId", '${DEFAULT_TENANT_ID}'),
      "unitId" = COALESCE("unitId", '${DEFAULT_UNIT_ID}'),
      "isActive" = COALESCE("isActive", true),
      "isDeleted" = COALESCE("isDeleted", false)
  `);

  const userHasUpdatedAt = await hasColumn('User', 'updatedAt');
  if (userHasUpdatedAt) {
    await apply('User updatedAt refresh', `UPDATE "User" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "updatedAt" IS NULL`);
  }

  await apply('User.firstName required', `ALTER TABLE "User" ALTER COLUMN "firstName" SET NOT NULL`);
  await apply('User.tenantId required', `ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL`);
  await apply('User.unitId required', `ALTER TABLE "User" ALTER COLUMN "unitId" SET NOT NULL`);
  await apply('User.isActive defaults', `ALTER TABLE "User" ALTER COLUMN "isActive" SET DEFAULT true`);
  await apply('User.isActive required', `ALTER TABLE "User" ALTER COLUMN "isActive" SET NOT NULL`);
  await apply('User.isDeleted defaults', `ALTER TABLE "User" ALTER COLUMN "isDeleted" SET DEFAULT false`);
  await apply('User.isDeleted required', `ALTER TABLE "User" ALTER COLUMN "isDeleted" SET NOT NULL`);

  await apply('User email unique index', `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`);
  await apply('User role index', `CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId")`);
  await apply('User tenant index', `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId")`);
  await apply('User unit index', `CREATE INDEX IF NOT EXISTS "User_unitId_idx" ON "User"("unitId")`);

  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      email: true,
      firstName: true,
      lastName: true,
      tenantId: true,
      unitId: true,
      isActive: true
    }
  });

  console.log(JSON.stringify({ ok: true, checkedUsers: users }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
