import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
    const tenantId = 'f866c6e5-949b-4b6f-a137-0ba659918b34'; // Use the tenantId I just found
    const unitId = 'ALL';
    
    const params = [tenantId];
    const filters = [
        '"tenantId" = $1',
        'COALESCE("isDeleted", false) = false',
        `"type"::text = 'INVOICE'`
    ];

    params.push(10); // limit

    try {
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
        WHERE ${filters.join('\n          AND ')}
        ORDER BY "createdAt" DESC
        LIMIT $${params.length}
        `, ...params);
        console.log("Returned rows:", res.length);
        console.log(res.filter(r => r.category === 'Manual Billing'));
    } catch(e) {
        console.error("Query Error:", e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
