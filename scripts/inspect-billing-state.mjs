import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const allocationTaggedTasks = await prisma.task.findMany({
    where: {
        isDeleted: false,
        description: { contains: 'Allocation:' }
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
        id: true,
        refNo: true,
        status: true,
        unitId: true,
        tenantId: true,
        description: true,
        completedAt: true,
        updatedAt: true
    }
});

const invoices = await prisma.accountTransaction.findMany({
    where: {
        isDeleted: false,
        type: 'INVOICE'
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
        id: true,
        refNo: true,
        status: true,
        amount: true,
        unitId: true,
        tenantId: true,
        allocationId: true,
        metadata: true,
        createdAt: true
    }
});

const allocations = await prisma.allocation.findMany({
    where: {
        isDeleted: false
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
        id: true,
        refNo: true,
        status: true,
        unitId: true,
        tenantId: true,
        metadata: true,
        updatedAt: true
    }
});

console.log(JSON.stringify({
    allocationTaggedTasks,
    invoices,
    allocations
}, null, 2));

await prisma.$disconnect();
