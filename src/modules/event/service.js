import { EventEmitter } from 'events';
import { prisma } from '../../app/prisma.js';
import { getContext } from '../../shared/utils/context.js';
import { addAutomationJob } from '../../automation-engine/queue/queue.js';

const eventEmitter = new EventEmitter();

// Define Event Constants
export const EVENTS = {
    ENQUIRY_CREATED: 'ENQUIRY_CREATED',
    ENQUIRY_FOLLOW_UP: 'ENQUIRY_FOLLOW_UP',
    ENQUIRY_CONVERTED: 'ENQUIRY_CONVERTED',
    TASK_CREATED: 'TASK_CREATED',
    INVOICE_CREATED: 'INVOICE_CREATED',
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    APPROVAL_REQUIRED: 'APPROVAL_REQUIRED'
};

// Listener Registrations
eventEmitter.on(EVENTS.ENQUIRY_CREATED, async (payload) => {
    console.log(`Event triggered: ${EVENTS.ENQUIRY_CREATED}`, payload);
    const ctx = getContext();

    if (!ctx?.tenantId || !ctx?.unitId) {
        console.warn("⚠️ Skipping audit log — missing context");
        return;
    }

    /*
    await prisma.auditLog.create({
        data: {
            userId: ctx.userId || null,
            tenantId: ctx.tenantId,
            unitId: ctx.unitId,
            module: "ENQUIRY",
            action: "CREATE",
            payload: JSON.parse(JSON.stringify(payload))
        }
    });
    */

    // 🚀 DISPATCH TO WORKER
    await addAutomationJob({
        module: 'enquiry',
        event: EVENTS.ENQUIRY_CREATED,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId,
        entityId: payload.enquiry.id,
        status: payload.enquiry.status,
        input: {
            comments: payload.enquiry.description || "",
            description: payload.enquiry.description || "",
            rawMessage: payload.enquiry.rawMessage || "",
            status: payload.enquiry.status
        }
    });
});

eventEmitter.on(EVENTS.ENQUIRY_FOLLOW_UP, async (payload) => {
    console.log(`Event triggered: ${EVENTS.ENQUIRY_FOLLOW_UP}`, payload);
    const ctx = getContext();
    if (!ctx?.tenantId || !ctx?.unitId) return;

    await addAutomationJob({
        module: 'enquiry',
        event: EVENTS.ENQUIRY_FOLLOW_UP,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId,
        entityId: payload.enquiryId,
        input: {
            notes: payload.followUp.notes || "",
            outcome: payload.followUp.outcome || "Pending",
            clientInterest: payload.followUp.clientInterest || "Neutral",
            hasAttachment: !!(payload.followUp.attachments?.length || payload.followUp.attachmentName)
        }
    });
});

eventEmitter.on(EVENTS.ENQUIRY_CONVERTED, async (payload) => {
    console.log(`Event triggered: ${EVENTS.ENQUIRY_CONVERTED}`, payload);
    // e.g. Trigger Allocation
});

eventEmitter.on(EVENTS.TASK_CREATED, async (payload) => {
    console.log(`Event triggered: ${EVENTS.TASK_CREATED}`, payload);
    const ctx = getContext();
    if (!ctx?.tenantId || !ctx?.unitId) return;

    await addAutomationJob({
        module: 'tasks',
        event: EVENTS.TASK_CREATED,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId,
        entityId: payload.task.id,
        taskType: payload.task.type,
        input: {
            title: payload.task.title,
            description: payload.task.description || ''
        }
    });
});

eventEmitter.on(EVENTS.INVOICE_CREATED, async (payload) => {
    console.log(`Event triggered: ${EVENTS.INVOICE_CREATED}`, payload);
    const ctx = getContext();
    if (!ctx?.tenantId || !ctx?.unitId) return;

    await addAutomationJob({
        module: 'accounts',
        event: EVENTS.INVOICE_CREATED,
        tenantId: ctx.tenantId,
        unitId: ctx.unitId,
        entityId: payload.invoice?.id || payload.transaction?.id,
        options: payload.options || {}
    });
});

eventEmitter.on(EVENTS.TASK_ASSIGNED, async (payload) => {
    console.log(`Event triggered: ${EVENTS.TASK_ASSIGNED}`, payload);
    // e.g. Notification Trigger
});

export const emitEvent = (eventName, payload) => {
    eventEmitter.emit(eventName, payload);
};
