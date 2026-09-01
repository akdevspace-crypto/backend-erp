import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();

const buildDescription = (allocation) => [
    `Allocation:${allocation.id}`,
    `Reference: ${allocation.refNo}`,
    `Client: ${allocation.enquiry?.client?.name || 'Client pending'}`,
    `Patient: ${allocation.metadata?.patientName || allocation.enquiry?.client?.name || 'Patient pending'}`,
    `Care Type: ${allocation.type}`,
    allocation.metadata?.notes ? `Notes: ${allocation.metadata.notes}` : null
].filter(Boolean).join('\n');

const nextRefNo = async (tenantId, unitId) => {
    const prefix = 'TSK';
    const counter = await prisma.refCounter.upsert({
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

const allocations = await prisma.allocation.findMany({
    where: {
        staffId: { not: null },
        status: 'ALLOCATED',
        isDeleted: false
    },
    include: {
        enquiry: {
            select: {
                id: true,
                refNo: true,
                client: { select: { name: true } },
                service: { select: { name: true } }
            }
        },
        staff: {
            select: {
                id: true,
                userId: true
            }
        }
    }
});

let created = 0;
let updated = 0;

for (const allocation of allocations) {
    if (!allocation.staff) continue;

    const description = buildDescription(allocation);
    const existing = await prisma.task.findFirst({
        where: {
            tenantId: allocation.tenantId,
            unitId: allocation.unitId,
            isDeleted: false,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            description: { contains: `Allocation:${allocation.id}` }
        },
        select: { id: true }
    });

    const taskData = {
        title: `${allocation.enquiry?.service?.name || 'Care Duty'} duty - ${allocation.enquiry?.client?.name || 'Client'}`,
        description,
        type: allocation.endDate ? 'SCHEDULED' : 'DAILY',
        priority: allocation.metadata?.priority || 'MEDIUM',
        assigneeId: allocation.staff.userId || null,
        assignedStaffId: allocation.staff.id,
        enquiryId: allocation.enquiryId,
        dueDate: allocation.startDate || new Date(),
        tenantId: allocation.tenantId,
        unitId: allocation.unitId,
        status: 'ASSIGNED'
    };

    if (existing) {
        await prisma.task.update({
            where: { id: existing.id },
            data: taskData
        });
        updated += 1;
    } else {
        await prisma.task.create({
            data: {
                refNo: await nextRefNo(allocation.tenantId, allocation.unitId),
                ...taskData
            }
        });
        created += 1;
    }
}

console.log(`Allocation duty task backfill complete. Created: ${created}, Updated: ${updated}`);

await prisma.$disconnect();
