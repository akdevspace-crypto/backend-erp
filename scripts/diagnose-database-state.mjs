import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const maskDatabaseUrl = (value) => {
    if (!value) return null;
    try {
        const parsed = new URL(value);
        if (parsed.password) parsed.password = '***';
        if (parsed.username) parsed.username = `${parsed.username.slice(0, 3)}***`;
        return parsed.toString();
    } catch {
        return '[unparseable database url]';
    }
};

const tableNames = [
    'Tenant',
    'Unit',
    'User',
    'Role',
    'Staff',
    'Client',
    'Enquiry',
    'Allocation',
    'Task',
    'AccountTransaction',
    'Invoice',
    'RefCounter'
];

const existingTables = await prisma.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY table_name
`, tableNames);

const existingSet = new Set(existingTables.map((row) => row.table_name));
const tableCounts = {};

for (const tableName of tableNames) {
    if (!existingSet.has(tableName)) {
        tableCounts[tableName] = 'MISSING';
        continue;
    }

    try {
        const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "${tableName}"`);
        tableCounts[tableName] = rows?.[0]?.count ?? 0;
    } catch (error) {
        tableCounts[tableName] = `ERROR: ${error?.message || error}`;
    }
}

const enumRows = await prisma.$queryRawUnsafe(`
    SELECT typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND typname = ANY($1)
    ORDER BY typname
`, ['TransactionType', 'TransactionStatus', 'TaskStatus', 'AllocationStatus', 'EnquiryStatus']);

const accountColumns = existingSet.has('AccountTransaction')
    ? await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AccountTransaction'
        ORDER BY ordinal_position
    `)
    : [];

const userSamples = existingSet.has('User')
    ? await prisma.$queryRawUnsafe(`
        SELECT "email", "firstName", "tenantId", "unitId"
        FROM "User"
        ORDER BY "createdAt" DESC
        LIMIT 5
    `)
    : [];

console.log(JSON.stringify({
    database: {
        DATABASE_URL: maskDatabaseUrl(process.env.DATABASE_URL),
        DIRECT_URL: maskDatabaseUrl(process.env.DIRECT_URL),
        SUPABASE_POOLER_HOST: process.env.SUPABASE_POOLER_HOST || null
    },
    existingTables: [...existingSet],
    missingTables: tableNames.filter((name) => !existingSet.has(name)),
    tableCounts,
    enums: enumRows.map((row) => row.typname),
    accountColumns,
    userSamples
}, null, 2));

await prisma.$disconnect();
