import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        const tenantId = 'T-001'; // Try generic, maybe this is wrong? Let's query any tenant first.
        const res = await prisma.$queryRawUnsafe(`
        SELECT * FROM (
            SELECT
                "id",
                "refNo",
                "allocationId",
                "type"::text AS "type",
                "amount",
                "paymentMode",
                "category",
                "clientName",
                "status"::text AS "status",
                "notes",
                "metadata",
                "date",
                "tenantId",
                "unitId",
                "isDeleted",
                "deletedAt",
                "createdAt",
                "updatedAt"
            FROM "AccountTransaction"
            UNION ALL
            SELECT
                "id",
                "refNo",
                NULL::text AS "allocationId",
                'INVOICE' AS "type",
                "amount",
                NULL::text AS "paymentMode",
                'Manual Billing' AS "category",
                COALESCE("metadata"->>'patientName', 'Manual Bill') AS "clientName",
                "status"::text AS "status",
                'Manual Bill Generation' AS "notes",
                "metadata",
                "createdAt" AS "date",
                "tenantId",
                "unitId",
                false AS "isDeleted",
                NULL::timestamp AS "deletedAt",
                "createdAt",
                "updatedAt"
            FROM "Invoice"
        ) AS "CombinedInvoices"
        LIMIT 10
        `);
        console.log(JSON.stringify(res, null, 2));
    } catch(e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
