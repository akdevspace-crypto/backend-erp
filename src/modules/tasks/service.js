import { prisma } from '../../app/prisma.js';
import { hasConfiguredMenuPrivilege } from '../hr/service.js';
import { StaffIntelligenceService } from '../../intelligence/services/staff-intelligence.service.js';
import { sendNotification } from '../notification/service.js';
import { postAccountInvoiceToPatientLedger, reconcileAllocationCompletionBilling } from '../patient_billing/ledger.js';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const taskStaffSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    metadata: true,
    isDeleted: true
};

const taskListInclude = {
    assignee: {
        include: {
            staff: {
                select: taskStaffSelect
            }
        }
    },
    assignedStaff: {
        select: taskStaffSelect
    },
    approvalAuthority: {
        include: {
            staff: {
                select: taskStaffSelect
            }
        }
    }
};

const normalizeIdentifier = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

const localDateKey = (date = new Date(), timeZone = 'Asia/Kolkata') => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
};

const taskDateRangeForToday = () => {
    const todayKey = localDateKey();
    const start = new Date(`${todayKey}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
};

const extractAllocationIdFromTask = (task) => {
    const description = String(task?.description || '');
    const match = description.match(/Allocation:([0-9a-f-]{36})/i);
    return match?.[1] || null;
};

const extractDailyOperationTaskIdFromTask = (task) => {
    const description = String(task?.description || '');
    const match = description.match(/DailyOperationTask:([A-Za-z0-9_-]+)/i);
    return match?.[1] || null;
};

const extractStaffRemarksFromTask = (task) => {
    const description = String(task?.description || '');
    const match = description.match(/Staff Notes:\s*([\s\S]*?)(?:\n[A-Za-z][A-Za-z ]+:\s|$)/i);
    return match?.[1]?.trim() || '';
};

const upsertStaffRemarksInDescription = (description, remarks) => {
    const cleanDescription = String(description || '').replace(/\nStaff Notes:\s*[\s\S]*?(?=\n[A-Za-z][A-Za-z ]+:\s|$)/i, '').trim();
    const cleanRemarks = String(remarks || '').trim();
    return cleanRemarks ? `${cleanDescription}\nStaff Notes: ${cleanRemarks}` : cleanDescription;
};

const extractComplaintIdFromTask = (task) => {
    const description = String(task?.description || '');
    const match = description.match(/Complaint:([0-9a-f-]{36})/i);
    return match?.[1] || null;
};

const syncComplaintTaskStatus = async (tx, task, status) => {
    const complaintId = extractComplaintIdFromTask(task);
    if (!complaintId) return;

    const normalizedStatus = String(status || '').toUpperCase();
    const nextComplaintStatus = normalizedStatus === 'COMPLETED'
        ? 'RESOLVED'
        : normalizedStatus === 'APPROVED'
            ? 'CLOSED'
            : normalizedStatus === 'REJECTED'
                ? 'ASSIGNED'
                : normalizedStatus === 'IN_PROGRESS'
                    ? 'ASSIGNED'
                    : null;

    if (!nextComplaintStatus) return;

    const complaint = await tx.complaint.findFirst({
        where: {
            id: complaintId,
            tenantId: task.tenantId,
            unitId: task.unitId,
            isDeleted: false
        },
        select: {
            id: true,
            status: true,
            metadata: true
        }
    });

    if (!complaint || complaint.status === nextComplaintStatus) return;

    const metadata = complaint.metadata && typeof complaint.metadata === 'object'
        ? complaint.metadata
        : {};
    const now = new Date();

    await tx.complaint.update({
        where: { id: complaint.id },
        data: {
            status: nextComplaintStatus,
            metadata: {
                ...metadata,
                complaintTaskId: task.id,
                complaintTaskRefNo: task.refNo || metadata.complaintTaskRefNo || null,
                taskCompletedAt: normalizedStatus === 'COMPLETED' ? now : metadata.taskCompletedAt || null,
                taskApprovedAt: normalizedStatus === 'APPROVED' ? now : metadata.taskApprovedAt || null,
                resolvedAt: nextComplaintStatus === 'RESOLVED' ? now : metadata.resolvedAt || null,
                closedAt: nextComplaintStatus === 'CLOSED' ? now : metadata.closedAt || null,
                lastWorkflowActionAt: now
            }
        }
    });

    await tx.workflowLog.create({
        data: {
            entityType: 'COMPLAINT',
            entityId: complaint.id,
            fromState: complaint.status,
            toState: nextComplaintStatus,
            actionBy: task.assigneeId || task.assignedStaffId || null,
            notes: `Complaint synced from task ${task.refNo || task.id} status ${normalizedStatus}`,
            tenantId: task.tenantId,
            unitId: task.unitId
        }
    });
};

const syncDailyOperationTaskStatus = async (tx, task, status) => {
    const dailyOperationTaskId = extractDailyOperationTaskIdFromTask(task);
    if (!dailyOperationTaskId) return;

    const dailyStatus = status === 'COMPLETED' || status === 'APPROVED'
        ? 'COMPLETED'
        : status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : 'PENDING';
    const staffRemarks = extractStaffRemarksFromTask(task);
    const completedAt = dailyStatus === 'COMPLETED'
        ? (task.completedAt || new Date())
        : null;

    await tx.$executeRaw`
        UPDATE "DailyOperationTask"
        SET "status" = ${dailyStatus},
            "completedAt" = ${completedAt},
            "remarks" = ${staffRemarks || null},
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${dailyOperationTaskId}
          AND "tenantId" = ${task.tenantId}
          AND "unitId" = ${task.unitId}
          AND "isDeleted" = false
    `;
};

const buildApprovedServiceHistoryEntry = ({ task, allocation }) => ({
    taskId: task.id,
    taskRefNo: task.refNo,
    title: task.title,
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
    completedAt: task.completedAt?.toISOString?.() || new Date().toISOString(),
    staffId: task.assignedStaffId || allocation.staffId || null,
    staffName: task.assignedStaff
        ? `${task.assignedStaff.firstName} ${task.assignedStaff.lastName || ''}`.trim()
        : null,
    careType: allocation.type,
    notes: allocation.metadata?.notes || null
});

const syncApprovedServiceInvoice = async (tx, task, allocation) => {
    const existingInvoice = await tx.accountTransaction.findFirst({
        where: {
            allocationId: allocation.id,
            type: 'INVOICE',
            tenantId: task.tenantId,
            unitId: task.unitId,
            isDeleted: false
        }
    });

    if (existingInvoice) {
        await postAccountInvoiceToPatientLedger(tx, existingInvoice, task.assignedStaffId || null);
        return;
    }

    const servicePrice = Number(
        allocation.metadata?.readyToPayAmount ||
        allocation.enquiry?.readyToPayAmount ||
        allocation.enquiry?.service?.price ||
        0
    );
    const invoiceCounter = await tx.refCounter.upsert({
        where: {
            prefix_tenantId: {
                prefix: 'INV',
                tenantId: task.tenantId
            }
        },
        update: { current: { increment: 1 } },
        create: {
            prefix: 'INV',
            tenantId: task.tenantId,
            unitId: task.unitId,
            current: 1
        }
    });

    const invoice = await tx.accountTransaction.create({
        data: {
            refNo: `INV-${String(invoiceCounter.current).padStart(6, '0')}`,
            allocationId: allocation.id,
            type: 'INVOICE',
            amount: servicePrice,
            paymentMode: allocation.enquiry?.paymentMode || allocation.metadata?.paymentMode || null,
            category: allocation.enquiry?.service?.name || `${allocation.type.replace(/_/g, ' ')} Care`,
            clientName: allocation.enquiry?.client?.name || allocation.metadata?.patientName || 'Client',
            notes: `Auto-drafted from approved duty ${task.refNo}`,
            status: 'CREATED',
            metadata: {
                source: 'APPROVED_SERVICE_DUTY',
                allocationId: allocation.id,
                allocationRef: allocation.refNo,
                taskId: task.id,
                taskRefNo: task.refNo,
                patientName: allocation.metadata?.patientName || null,
                serviceDeliveredAt: new Date().toISOString()
            },
            tenantId: task.tenantId,
            unitId: task.unitId
        }
    });

    await postAccountInvoiceToPatientLedger(tx, invoice, task.assignedStaffId || null);
};

const syncApprovedAllocationDuty = async (tx, task) => {
    const allocationId = extractAllocationIdFromTask(task);
    if (!allocationId || task.status !== 'APPROVED') return;

    const allocation = await tx.allocation.findFirst({
        where: {
            id: allocationId,
            tenantId: task.tenantId,
            unitId: task.unitId,
            isDeleted: false
        },
        include: {
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true
                }
            },
            enquiry: {
                include: {
                    client: true,
                    service: true
                }
            }
        }
    });

    if (!allocation) return;

    const existingMetadata = allocation.metadata && typeof allocation.metadata === 'object'
        ? allocation.metadata
        : {};
    const serviceHistory = Array.isArray(existingMetadata.serviceHistory)
        ? existingMetadata.serviceHistory.filter((entry) => entry?.taskId !== task.id)
        : [];

    serviceHistory.unshift(buildApprovedServiceHistoryEntry({ task, allocation }));

    await tx.allocation.update({
        where: { id: allocation.id },
        data: {
            status: 'COMPLETED',
            endDate: allocation.endDate || new Date(),
            metadata: {
                ...existingMetadata,
                serviceHistory,
                serviceDeliveredAt: new Date().toISOString(),
                serviceDeliveredByTaskId: task.id,
                lastApprovedDutyTaskRef: task.refNo
            }
        }
    });

    if (task.assignedStaffId || allocation.staffId) {
        const staffId = task.assignedStaffId || allocation.staffId;
        await tx.staff.updateMany({
            where: {
                id: staffId,
                tenantId: task.tenantId,
                currentWorkload: { gt: 0 }
            },
            data: {
                currentWorkload: { decrement: 1 }
            }
        });
    }

    await syncApprovedServiceInvoice(tx, task, allocation);
    await reconcileAllocationCompletionBilling(tx, {
        tenantId: task.tenantId,
        allocationId: allocation.id,
        completedAt: task.completedAt || new Date(),
        createdBy: task.assignedStaffId || null
    });
};

const normalizeRoleName = (value) => String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');

const resolveTaskApprovalNotificationRecipients = async (task) => {
    const recipients = new Set();

    if (task.approvalAuthorityId) {
        recipients.add(task.approvalAuthorityId);
    }

    const users = await prisma.user.findMany({
        where: {
            tenantId: task.tenantId,
            isActive: true,
            isDeleted: false
        },
        select: {
            id: true,
            unitId: true,
            role: {
                select: { name: true }
            }
        }
    });

    users.forEach((user) => {
        const roleName = normalizeRoleName(user.role?.name);
        const isSuperAdmin = roleName === 'super admin' || roleName === 'superadmin';
        const isAdmin = roleName === 'admin' || roleName.endsWith(' admin');
        const isSupervisor = roleName.includes('supervisor');

        if (isSuperAdmin || ((isAdmin || isSupervisor) && (!user.unitId || user.unitId === task.unitId))) {
            recipients.add(user.id);
        }
    });

    if (task.assigneeId) {
        recipients.delete(task.assigneeId);
    }

    return [...recipients];
};

const notifyTaskSubmittedForApproval = async (task) => {
    if (String(task.status).toUpperCase() !== 'COMPLETED') return;

    try {
        const recipientIds = await resolveTaskApprovalNotificationRecipients(task);
        if (!recipientIds.length) return;

        const staffName = task.assignedStaff
            ? `${task.assignedStaff.firstName} ${task.assignedStaff.lastName || ''}`.trim()
            : 'Assigned staff';
        const isScheduledTask = String(task.type || '').toUpperCase() === 'SCHEDULED';
        const approvalRoute = isScheduledTask ? '/task-log/schedule-approval' : '/task-log/daily-approval';

        await Promise.allSettled(recipientIds.map((userId) => sendNotification({
            userId,
            type: 'TASK_APPROVAL_REQUIRED',
            message: `${staffName} completed ${task.refNo || 'a task'}: ${task.title}. Please review it in ${isScheduledTask ? 'Scheduled Task Approval' : 'Daily Task Approval'}.`,
            targetUrl: `${approvalRoute}?taskId=${encodeURIComponent(task.id)}`,
            metadata: {
                taskId: task.id,
                taskRefNo: task.refNo,
                nextStep: isScheduledTask ? 'SCHEDULE_TASK_APPROVAL' : 'DAILY_TASK_APPROVAL'
            },
            tenantId: task.tenantId,
            unitId: task.unitId
        })));
    } catch (error) {
        console.error('Task completed but approval notification dispatch failed:', error);
    }
};

const findUserWithLinkedStaff = async (tenantId, unitId, normalizedIdentifier) => {
    const scopedUser = await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            unitId,
            isDeleted: false,
            staff: {
                is: {
                    tenantId,
                    unitId,
                    isDeleted: false
                }
            }
        },
        include: {
            role: true,
            staff: {
                select: taskStaffSelect
            }
        }
    });

    if (scopedUser) {
        return scopedUser;
    }

    return prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            isDeleted: false,
            staff: {
                is: {
                    tenantId,
                    isDeleted: false
                }
            }
        },
        include: {
            role: true,
            staff: {
                select: taskStaffSelect
            }
        }
    });
};

const resolveStaffLinkedUser = async (tenantId, unitId, identifier) => {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    if (!normalizedIdentifier) return null;

    const user = await findUserWithLinkedStaff(tenantId, unitId, normalizedIdentifier);

    if (user) {
        return user;
    }

    const userWithLinkedStaff = await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            unitId,
            isDeleted: false
        },
        include: {
            role: true
        }
    });

    const crossUnitUserWithLinkedStaff = userWithLinkedStaff || await prisma.user.findFirst({
        where: {
            id: normalizedIdentifier,
            tenantId,
            isDeleted: false
        },
        include: {
            role: true
        }
    });

    if (crossUnitUserWithLinkedStaff) {
        const linkedStaff = await prisma.staff.findFirst({
            where: {
                userId: crossUnitUserWithLinkedStaff.id,
                tenantId,
                isDeleted: false
            },
            select: taskStaffSelect
        });

        if (linkedStaff) {
            return {
                ...crossUnitUserWithLinkedStaff,
                staff: linkedStaff
            };
        }
    }

    const staff = await prisma.staff.findFirst({
        where: {
            OR: [
                { id: normalizedIdentifier },
                { userId: normalizedIdentifier },
                { empId: normalizedIdentifier }
            ],
            tenantId,
            isDeleted: false
        },
        include: {
            user: {
                include: {
                    role: true
                }
            }
        }
    });

    return staff?.user
        ? {
            ...staff.user,
            staff
        }
        : null;
};

export const resolveAssignableStaffContext = async (tenantId, unitId, assigneeId) => {
    if (!assigneeId) return null;

    const user = await resolveStaffLinkedUser(tenantId, unitId, assigneeId);

    if (!user || !user.staff) {
        throw buildHttpError('Staff has no login. Enable login during onboarding.');
    }

    const staffStatus = String(user.staff.status || '').trim().toUpperCase();
    if (staffStatus === 'RESIGNED' || staffStatus === 'TERMINATED') {
        throw buildHttpError('Inactive staff cannot be assigned new tasks.');
    }

    if (!user.isActive) {
        throw buildHttpError('Staff login is disabled. Reactivate login before scheduling tasks.');
    }

    if (!user.roleId || !user.role) {
        throw buildHttpError('Staff has no privilege assigned. Assign a role before scheduling tasks.');
    }

    if (!hasConfiguredMenuPrivilege(user.staff.metadata)) {
        throw buildHttpError('Staff has no menu privilege configured. Configure menu privilege before scheduling tasks.');
    }

    return {
        userId: user.id,
        staffId: user.staff.id,
        user
    };
};

const ensureApprovalAuthorityUser = async (tenantId, unitId, approvalAuthorityId) => {
    if (!approvalAuthorityId) return null;

    const user = await resolveStaffLinkedUser(tenantId, unitId, approvalAuthorityId);

    if (!user || !user.isActive) {
        throw buildHttpError('Invalid approval authority selected');
    }

    return user.id;
};

export const createTask = async (tenantId, unitId, data) => {
    if (!data.assigneeId) {
        throw buildHttpError('Assignee is required for manual task creation.');
    }

    const assigneeContext = await resolveAssignableStaffContext(tenantId, unitId, data.assigneeId);
    const approvalAuthorityUserId = await ensureApprovalAuthorityUser(tenantId, unitId, data.approvalAuthorityId);

    return prisma.task.create({
        data: {
            refNo: `TSK-${Date.now()}`,
            title: data.title,
            description: data.description,
            type: data.type,
            priority: data.priority || 'MEDIUM',
            assigneeId: assigneeContext?.userId || null,
            assignedStaffId: assigneeContext?.staffId || null,
            approvalAuthorityId: approvalAuthorityUserId || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            tenantId,
            unitId,
            status: 'ASSIGNED'
        }
    });
};

export const createAITaskFromEnquiry = async (tenantId, unitId, data) => {
    if (!data?.enquiryId) {
        throw buildHttpError('enquiryId is required for AI task creation.');
    }

    if (!data?.title || !data?.type || !data?.priority) {
        throw buildHttpError('AI task generation failed');
    }

    await ensureApprovalAuthorityUser(tenantId, unitId, data.approvalAuthorityId);

    return prisma.task.create({
        data: {
            refNo: `TSK-${Date.now()}`,
            title: data.title,
            description: data.description || data.title,
            type: data.type,
            priority: data.priority,
            aiSummary: data.aiSummary || data.title,
            aiUrgency: data.aiUrgency || data.priority,
            enquiryId: data.enquiryId,
            approvalAuthorityId: data.approvalAuthorityId || null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            tenantId,
            unitId,
            status: 'ASSIGNED'
        }
    });
};

export const getTasks = async (tenantId, unitId, filters = {}) => {
    const { approvalQueue, ...taskFilters } = filters;
    const where = { tenantId, isDeleted: false, ...taskFilters };

    // Staff self-service and approval queues may span units under the same tenant.
    // Default operational lists stay scoped to the active unit.
    if (!taskFilters.assigneeId && !taskFilters.assignedStaffId && !taskFilters.approvalAuthorityId && !approvalQueue && unitId) {
        where.unitId = unitId;
    }

    return prisma.task.findMany({
        where,
        include: taskListInclude,
        orderBy: { createdAt: 'desc' }
    });
};

export const getMyTasks = async (tenantId, userId) => {
    const staff = await prisma.staff.findFirst({
        where: {
            tenantId,
            userId,
            isDeleted: false
        },
        select: { id: true }
    });
    const { start: todayStart, end: tomorrowStart } = taskDateRangeForToday();

    return prisma.task.findMany({
        where: {
            tenantId,
            isDeleted: false,
            AND: [
                {
                    OR: [
                        { assigneeId: userId },
                        ...(staff?.id ? [{ assignedStaffId: staff.id }] : [])
                    ]
                },
                {
                    OR: [
                        { description: { not: { contains: 'DailyOperationTask:' } } },
                        {
                            AND: [
                                { description: { contains: 'DailyOperationTask:' } },
                                { dueDate: { gte: todayStart, lt: tomorrowStart } }
                            ]
                        }
                    ]
                }
            ]
        },
        include: taskListInclude,
        orderBy: { createdAt: 'desc' }
    });
};

export const updateTaskStatus = async (id, tenantId, unitId, status, feedbackScore = null, options = {}) => {
    const existing = await prisma.task.findFirst({
        where: { id, tenantId, isDeleted: false },
        select: { id: true, assigneeId: true, unitId: true, description: true }
    });
    if (!existing) {
        const error = new Error('Task not found');
        error.status = 404;
        throw error;
    }

    const task = await prisma.$transaction(async (tx) => {
        const requestedCompletedAt = options.completedAt ? new Date(options.completedAt) : null;
        const safeCompletedAt = requestedCompletedAt && !Number.isNaN(requestedCompletedAt.getTime())
            ? requestedCompletedAt
            : new Date();
        const nextDescription = typeof options.remarks === 'string'
            ? upsertStaffRemarksInDescription(existing.description, options.remarks)
            : undefined;
        const updatedTask = await tx.task.update({
            where: { id },
            data: {
                status,
                feedbackScore: feedbackScore !== null ? feedbackScore : undefined,
                description: nextDescription,
                completedAt: (status === 'COMPLETED' || status === 'APPROVED') ? safeCompletedAt : undefined
            },
            include: {
                assignedStaff: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                },
                approvalAuthority: {
                    select: {
                        id: true
                    }
                }
            }
        });

        await syncApprovedAllocationDuty(tx, updatedTask);
        await syncDailyOperationTaskStatus(tx, updatedTask, status);
        await syncComplaintTaskStatus(tx, updatedTask, status);

        return updatedTask;
    });

    if (task.assigneeId) {
        await StaffIntelligenceService.updateStaffIntelligence(task.assigneeId);
    }

    await notifyTaskSubmittedForApproval(task);

    return task;
};
