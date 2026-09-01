import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({
        where: { email: 'uec.finance@demo.erp' },
        include: { role: true }
    });

    if (!user) {
        console.error('User not found');
        return;
    }

    // we don't have the full buildSessionUser logic here easily, but we can just use the db query
    // Let's directly run the query that routes.ts runs for UEC
    const tenantId = user.tenantId;
    const unitId = user.unitId;

    const entries = await prisma.$queryRaw`
        SELECT *
        FROM "PatientDailyCost"
        WHERE "tenantId" = ${tenantId}
          AND "unitId" = ${unitId}
          AND "isDeleted" = false
        ORDER BY "costDate" DESC, "createdAt" DESC
    `;

    console.log(`Found ${entries.length} entries for ${user.email} (unit: ${unitId})`);
}

main().finally(() => prisma.$disconnect());
