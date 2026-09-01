import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const parseAllocationId = (description = '') => {
    const match = String(description).match(/Allocation:([0-9a-f-]+)/i);
    return match?.[1] || null;
};

const nextInvoiceRef = async (tx, tenantId, unitId) => {
    const prefix = 'INV';
    const counter = await tx.refCounter.upsert({
        where: {
            prefix_tenantId: {
                prefix,
                tenantId
            }
        },
        update: {
            current: {
                increment: 1
            }
        },
        create: {
            prefix,
            current: 1,
            tenantId,
            unitId
        }
    });

    return `${prefix}-${String(counter.current).padStart(6, '0')}`;
};

const resolveAmount = (allocation) => {
    const value = allocation.metadata?.readyToPayAmount
        ?? allocation.enquiry?.readyToPayAmount
        ?? allocation.enquiry?.service?.price
        ?? 0;
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const approvedTasks = await prisma.task.findMany({
    where: {
        status: 'APPROVED',
        isDeleted: false,
        description: {
            contains: 'Allocation:'
        }
    },
    select: {
        id: true,
        refNo: true,
        title: true,
        description: true,
        completedAt: true,
        tenantId: true,
        unitId: true
    }
});

let created = 0;
let skipped = 0;

for (const task of approvedTasks) {
    const allocationId = parseAllocationId(task.description);
    if (!allocationId) {
        skipped += 1;
        continue;
    }

    await prisma.$transaction(async (tx) => {
        const allocation = await tx.allocation.findFirst({
            where: {
                id: allocationId,
                tenantId: task.tenantId,
                unitId: task.unitId,
                isDeleted: false
            },
            include: {
                enquiry: {
                    include: {
                        client: true,
                        service: true
                    }
                }
            }
        });

        if (!allocation) {
            skipped += 1;
            return;
        }

        const existingInvoice = await tx.accountTransaction.findFirst({
            where: {
                allocationId: allocation.id,
                type: 'INVOICE',
                tenantId: task.tenantId,
                unitId: task.unitId,
                isDeleted: false
            },
            select: {
                id: true
            }
        });

        if (existingInvoice) {
            skipped += 1;
            return;
        }

        const amount = resolveAmount(allocation);
        await tx.accountTransaction.create({
            data: {
                refNo: await nextInvoiceRef(tx, task.tenantId, task.unitId),
                type: 'INVOICE',
                category: allocation.enquiry?.service?.name || allocation.type || 'Service',
                amount,
                paymentMode: allocation.enquiry?.paymentMode || allocation.metadata?.paymentMode || null,
                status: 'CREATED',
                date: task.completedAt || new Date(),
                notes: `Service invoice for ${allocation.refNo || task.refNo}`,
                clientName: allocation.enquiry?.client?.name || allocation.metadata?.patientName || 'Client',
                allocationId: allocation.id,
                metadata: {
                    source: 'APPROVED_SERVICE_DUTY_BACKFILL',
                    allocationId: allocation.id,
                    allocationRef: allocation.refNo,
                    taskId: task.id,
                    taskRefNo: task.refNo,
                    patientName: allocation.metadata?.patientName || allocation.enquiry?.client?.name || null,
                    serviceDeliveredAt: task.completedAt || null
                },
                tenantId: task.tenantId,
                unitId: task.unitId
            }
        });

        created += 1;
    });
}

console.log(`Service invoice draft backfill complete. Created: ${created}, Skipped: ${skipped}`);

await prisma.$disconnect();
