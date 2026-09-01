import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();
const execute = process.argv.includes('--execute');

const idList = (rows) => rows.map((row) => row.id);

async function remove(modelName, label, where) {
    const model = prisma[modelName];
    if (!model) {
        console.log(`SKIP ${label}: model ${modelName} not found`);
        return 0;
    }

    const count = await model.count({ where });
    if (!execute) {
        console.log(`DRY  ${label}: ${count}`);
        return count;
    }

    if (count === 0) {
        console.log(`DEL  ${label}: 0`);
        return 0;
    }

    const result = await model.deleteMany({ where });
    console.log(`DEL  ${label}: ${result.count}`);
    return result.count;
}

async function ids(modelName, where) {
    const model = prisma[modelName];
    if (!model) return [];
    return idList(await model.findMany({ where, select: { id: true } }));
}

async function main() {
    console.log(execute ? 'Executing demo/seed cleanup...' : 'Dry run only. Add --execute to delete.');

    const demoClientIds = await ids('client', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { refNo: { startsWith: 'SEED-' } },
            { email: { endsWith: '.demo' } },
            { email: { endsWith: '@demo.erp' } }
        ]
    });

    const demoEnquiryIds = await ids('enquiry', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { refNo: { startsWith: 'SEED-' } },
            { clientId: { in: demoClientIds } },
            { channelId: { startsWith: 'demo-' } },
            { description: { contains: 'seeded enquiry' } }
        ]
    });

    const demoStaffIds = await ids('staff', {
        OR: [
            { empId: { startsWith: 'DEMO-' } },
            { empId: { startsWith: 'SEED-' } },
            { email: { endsWith: '.demo' } },
            { email: { endsWith: '@demo.erp' } }
        ]
    });

    const demoAllocationIds = await ids('allocation', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { refNo: { startsWith: 'SEED-' } },
            { enquiryId: { in: demoEnquiryIds } },
            { staffId: { in: demoStaffIds } }
        ]
    });

    const demoComplaintIds = await ids('complaint', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { channelId: { startsWith: 'DEMO-' } },
            { description: { contains: 'Demo complaint' } }
        ]
    });

    const demoConversationIds = await ids('conversation', {
        OR: [
            { externalThreadId: { startsWith: 'DEMO-' } },
            { entityId: { in: demoEnquiryIds } },
            { enquiryId: { in: demoEnquiryIds } },
            { clientId: { in: demoClientIds } }
        ]
    });

    const demoTaskIds = await ids('task', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { enquiryId: { in: demoEnquiryIds } },
            { assignedStaffId: { in: demoStaffIds } },
            { description: { contains: 'demo task' } }
        ]
    });

    const demoProductIds = await ids('product', {
        OR: [
            { id: { startsWith: 'seed-' } },
            { name: { startsWith: 'Demo ' } },
            { name: { contains: 'Seed Stock' } }
        ]
    });

    const demoAdmissionRows = await prisma.admission.findMany({
        where: { enquiryId: { in: demoEnquiryIds } },
        select: { id: true, patientId: true }
    });
    const admittedPatientIds = demoAdmissionRows.map((row) => row.patientId);

    const demoVitalPatientIds = [
        ...new Set([
            ...admittedPatientIds,
            ...(await prisma.vitalSign.findMany({
                where: {
                    OR: [
                        { patientId: { startsWith: 'seed-' } },
                        { notes: { startsWith: 'Critical seeded vital' } },
                        { notes: 'Critical flag: review vitals and medication schedule.' },
                        { notes: 'Routine monitoring completed.' }
                    ]
                },
                select: { patientId: true }
            })).map((row) => row.patientId)
        ])
    ];

    const entityIds = [
        ...demoEnquiryIds,
        ...demoComplaintIds,
        ...demoTaskIds,
        ...demoAllocationIds,
        ...demoConversationIds
    ];

    await remove('message', 'omnichannel messages', {
        OR: [
            { conversationId: { in: demoConversationIds } },
            { externalMessageId: { startsWith: 'DEMO-' } }
        ]
    });
    await remove('channelIdentity', 'channel identities', {
        OR: [
            { conversationId: { in: demoConversationIds } },
            { clientId: { in: demoClientIds } }
        ]
    });
    await remove('communicationLog', 'communication logs', {
        OR: [
            { conversationId: { in: demoConversationIds } },
            { entityId: { in: demoEnquiryIds } },
            { channelId: { startsWith: 'DEMO-' } },
            { externalMessageId: { startsWith: 'DEMO-' } },
            { message: { contains: 'Demo omnichannel' } }
        ]
    });
    await remove('conversation', 'conversations', {
        id: { in: demoConversationIds }
    });

    await remove('automationTask', 'automation tasks', {
        OR: [
            { entityId: { in: entityIds } },
            { description: { contains: 'Demo automation' } }
        ]
    });
    await remove('automationLog', 'automation logs', {
        entityId: { in: entityIds }
    });
    await remove('automationFeedback', 'automation feedback', {
        entityId: { in: entityIds }
    });
    await remove('automationScore', 'automation scores', {
        OR: [
            { entityId: { in: demoEnquiryIds } },
            { complaintId: { in: demoComplaintIds } }
        ]
    });

    await remove('medicalAssignment', 'medical assignments', {
        OR: [
            { staffId: { in: demoStaffIds } },
            { patientId: { in: demoVitalPatientIds } },
            { admissionId: { in: idList(demoAdmissionRows) } },
            { enquiryId: { in: demoEnquiryIds } },
            { taskId: { in: demoTaskIds } },
            { allocationId: { in: demoAllocationIds } }
        ]
    });
    await remove('followUp', 'follow ups', {
        OR: [
            { enquiryId: { in: demoEnquiryIds } },
            { notes: { contains: 'seeded follow-up' } }
        ]
    });
    await remove('workflowLog', 'workflow logs', {
        entityId: { in: entityIds }
    });
    await remove('approval', 'approvals', {
        entityId: { in: entityIds }
    });
    await remove('accountTransaction', 'account transactions', {
        OR: [
            { refNo: { startsWith: 'DEMO-' } },
            { refNo: { startsWith: 'SEED-' } },
            { allocationId: { in: demoAllocationIds } }
        ]
    });
    await remove('task', 'tasks', {
        id: { in: demoTaskIds }
    });
    await remove('complaint', 'complaints', {
        id: { in: demoComplaintIds }
    });

    await remove('vitalSign', 'vital signs', {
        OR: [
            { patientId: { in: demoVitalPatientIds } },
            { patientId: { startsWith: 'seed-' } },
            { notes: { startsWith: 'Critical seeded vital' } }
        ]
    });
    await remove('medication', 'medications', {
        patientId: { in: demoVitalPatientIds }
    });
    await remove('nutrition', 'nutrition records', {
        patientId: { in: demoVitalPatientIds }
    });
    await remove('laundry', 'laundry records', {
        patientId: { in: demoVitalPatientIds }
    });
    await remove('admission', 'admissions', {
        OR: [
            { id: { in: idList(demoAdmissionRows) } },
            { patientId: { in: demoVitalPatientIds } },
            { enquiryId: { in: demoEnquiryIds } }
        ]
    });
    await remove('patient', 'patients', {
        id: { in: demoVitalPatientIds }
    });

    await remove('allocation', 'allocations', {
        id: { in: demoAllocationIds }
    });
    await remove('enquiry', 'enquiries', {
        id: { in: demoEnquiryIds }
    });
    await remove('client', 'clients', {
        id: { in: demoClientIds }
    });
    await remove('staff', 'staff', {
        id: { in: demoStaffIds }
    });

    await remove('stockIssueRequest', 'stock issue requests', {
        OR: [
            { productId: { in: demoProductIds } },
            { productName: { startsWith: 'Demo ' } },
            { productName: { contains: 'Seed Stock' } }
        ]
    });
    await remove('stock', 'stocks', {
        productId: { in: demoProductIds }
    });
    await remove('purchase', 'purchases', {
        productId: { in: demoProductIds }
    });
    await remove('product', 'products', {
        id: { in: demoProductIds }
    });

    await remove('jobApplication', 'job applications', {
        applicationNo: { startsWith: 'DEMO-' }
    });
    await remove('revenueForecast', 'revenue forecasts', {
        reasoning: { contains: 'Demo forecast' }
    });
    await remove('department', 'demo departments only', {
        code: { startsWith: 'DEMO-' }
    });
    await remove('clientService', 'demo client services only', {
        code: { startsWith: 'DEMO-' }
    });
    await remove('vendor', 'demo vendors only', {
        code: { startsWith: 'DEMO-' }
    });
    await remove('room', 'demo rooms only', {
        code: { startsWith: 'DEMO-' }
    });
    await remove('paymentCategory', 'demo payment categories only', {
        code: { startsWith: 'DEMO-' }
    });

    console.log('Cleanup scan complete.');
    console.log('Note: invoice, expense, maintenance, audit and blog rows from old seeds do not carry safe DEMO/SEED markers, so this script leaves them untouched.');
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
