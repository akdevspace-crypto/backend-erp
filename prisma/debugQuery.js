import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
    const allocations = await prisma.$queryRaw`
        SELECT a."id" AS "allocationId",
               a."status" AS "allocationStatus",
               e."status" AS "enquiryStatus",
               e."isConverted",
               a."unitId",
               e."rawMessage"
        FROM "Allocation" a
        JOIN "Enquiry" e ON e."id" = a."enquiryId"
        WHERE a."status" = 'COMPLETED'
    `;
    console.log('Completed Allocations globally:', allocations.map(a => ({
        id: a.allocationId,
        enqStatus: a.enquiryStatus,
        isConverted: a.isConverted,
        patientName: JSON.parse(a.rawMessage || '{}').patientName,
        unitId: a.unitId
    })));
}

main().finally(() => prisma.$disconnect());
