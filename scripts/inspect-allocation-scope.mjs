import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

try {
    const allocations = await prisma.allocation.findMany({
        where: {
            OR: [
                { enquiry: { refNo: 'ENQ-000004' } },
                { metadata: { path: ['patientName'], equals: 'tuv' } }
            ],
            isDeleted: false
        },
        select: {
            id: true,
            refNo: true,
            type: true,
            status: true,
            staffId: true,
            tenantId: true,
            unitId: true,
            enquiry: {
                select: {
                    id: true,
                    refNo: true,
                    client: { select: { name: true } },
                    service: { select: { name: true, category: true } }
                }
            },
            staff: {
                select: {
                    id: true,
                    empId: true,
                    firstName: true,
                    lastName: true,
                    unitId: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const units = await prisma.unit.findMany({
        where: { id: { in: [...new Set(allocations.flatMap((allocation) => [allocation.unitId, allocation.staff?.unitId]).filter(Boolean))] } },
        select: { id: true, name: true, code: true, shortName: true }
    });

    const unitById = new Map(units.map((unit) => [unit.id, unit]));

    console.log(JSON.stringify(allocations.map((allocation) => ({
        ...allocation,
        unit: unitById.get(allocation.unitId) || null,
        staff: allocation.staff ? {
            ...allocation.staff,
            unit: unitById.get(allocation.staff.unitId) || null
        } : null
    })), null, 2));
} finally {
    await prisma.$disconnect();
}
