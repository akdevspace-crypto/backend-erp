import { prisma } from '../../app/prisma.js';
import { generateRefNumber as generateRef } from '../../shared/utils/refGenerator.js';
import { ComplaintIntelligenceService } from '../../intelligence/services/complaint-intelligence.service.js';
import { ensurePatientBillingTables, reconcileAllocationCompletionBilling } from '../patient_billing/ledger.js';

const isMissingComplaintStorage = (error) => {
    return ['P2021', 'P2022', 'P2010'].includes(error?.code);
};

const parseJsonObject = (value) => {
    if (!value) return {};

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const isDemoOrSeedIdentifier = (value) => /(^|[^a-z0-9])(DEMO|SEED)[-_]/i.test(String(value || ''));

const resolveComplaintAssignee = async (tx, tenantId, staffId) => {
    if (!staffId) return null;

    const staff = await tx.staff.findFirst({
        where: {
            id: staffId,
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

    if (!staff) {
        const error = new Error('Selected complaint staff was not found');
        error.status = 400;
        throw error;
    }

    if (!staff.user || !staff.user.isActive) {
        const error = new Error('Selected complaint staff must have an active login to receive tasks');
        error.status = 400;
        throw error;
    }

    return {
        staffId: staff.id,
        userId: staff.user.id,
        name: `${staff.firstName} ${staff.lastName || ''}`.trim() || staff.empId,
        empId: staff.empId
    };
};

const createComplaintTask = async (tx, tenantId, userId, complaint, assignee) => {
    const metadata = complaint.metadata && typeof complaint.metadata === 'object' ? complaint.metadata : {};
    if (!assignee) return metadata.complaintTaskId || null;

    if (metadata.complaintTaskId) {
        const existingTask = await tx.task.findFirst({
            where: {
                id: metadata.complaintTaskId,
                tenantId,
                isDeleted: false
            },
            select: {
                id: true,
                status: true
            }
        });

        if (existingTask && !['APPROVED', 'VERIFIED'].includes(String(existingTask.status || '').toUpperCase())) {
            await tx.task.update({
                where: { id: existingTask.id },
                data: {
                    assigneeId: assignee.userId,
                    assignedStaffId: assignee.staffId,
                    status: String(existingTask.status || '').toUpperCase() === 'REJECTED'
                        ? 'ASSIGNED'
                        : existingTask.status
                }
            });
            return existingTask.id;
        }
    }

    const refNo = await generateRef('TSK', tenantId, complaint.unitId, tx);
    const task = await tx.task.create({
        data: {
            refNo,
            title: `Complaint follow-up - ${complaint.refNo}`,
            description: [
                `Complaint:${complaint.id}`,
                `Reference: ${complaint.refNo}`,
                `Client: ${metadata.clientName || 'Client'}`,
                `Category: ${complaint.type || metadata.category || 'Complaint'}`,
                `Priority: ${complaint.priority || metadata.priority || 'Medium'}`,
                `Notes: ${complaint.description || ''}`
            ].join('\n'),
            type: 'DAILY',
            priority: String(complaint.priority || metadata.priority || 'MEDIUM').toUpperCase(),
            assigneeId: assignee.userId,
            assignedStaffId: assignee.staffId,
            dueDate: new Date(),
            status: 'ASSIGNED',
            tenantId,
            unitId: complaint.unitId
        }
    });

    await tx.workflowLog.create({
        data: {
            entityType: 'COMPLAINT',
            entityId: complaint.id,
            fromState: 'ASSIGNED',
            toState: 'TASK_CREATED',
            actionBy: userId,
            notes: `Complaint task ${task.refNo} assigned to ${assignee.name}`,
            tenantId,
            unitId: complaint.unitId
        }
    });

    return task.id;
};

export const createComplaint = async (tenantId, data) => {
    const refNo = await generateRef('CMP', tenantId, data.unitId);
    const intelligence = await ComplaintIntelligenceService.analyzeComplaint(data);

    return prisma.complaint.create({
        data: {
            refNo,
            title: `${data.category} complaint from ${data.clientName}`,
            type: data.category || null,
            description: data.description,
            status: "OPEN",
            priority: data.priority || null,
            channel: data.metadata?.channel || null,
            channelId: data.metadata?.channelId || null,
            sentiment: intelligence.sentiment,
            urgency: intelligence.urgency,
            serviceTag: intelligence.serviceTag,
            metadata: {
                clientName: data.clientName,
                category: data.category,
                priority: data.priority,
                assignedTo: data.assignedTo || null,
                intelligence,
                attachmentUrl: data.attachmentUrl || null
            },
            unitId: data.unitId,
            tenantId,
        }
    });
};

export const getComplaints = async (tenantId, unitId) => {
    const where = { tenantId, isDeleted: false };
    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }

    try {
        return await prisma.complaint.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        if (isMissingComplaintStorage(error)) {
            console.warn('Complaint storage is not ready; returning an empty list.');
            return [];
        }
        throw error;
    }
};

export const updateComplaintWorkflow = async (tenantId, unitId, userId, complaintId, data) => {
    const requestedStatus = String(data.status || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const allowedStatuses = new Set(['OPEN', 'ASSIGNED', 'RESOLVED', 'CLOSED']);
    if (!allowedStatuses.has(requestedStatus)) {
        const error = new Error('Invalid complaint status');
        error.status = 400;
        throw error;
    }

    const result = await prisma.$transaction(async (tx) => {
        const where = {
            id: complaintId,
            tenantId,
            isDeleted: false
        };

        if (unitId && unitId !== 'ALL') {
            where.unitId = unitId;
        }

        const complaint = await tx.complaint.findFirst({ where });
        if (!complaint) {
            const error = new Error('Complaint not found or unauthorized');
            error.status = 404;
            throw error;
        }

        const metadata = complaint.metadata && typeof complaint.metadata === 'object' ? complaint.metadata : {};
        const now = new Date();
        const assignedTo = String(data.assignedTo || metadata.assignedStaffId || metadata.assignedTo || '').trim();
        const resolutionNotes = String(data.resolutionNotes || data.notes || '').trim();
        const assignee = assignedTo && !['RESOLVED', 'CLOSED'].includes(requestedStatus)
            ? await resolveComplaintAssignee(tx, tenantId, assignedTo)
            : null;
        const effectiveStatus = assignee && requestedStatus === 'OPEN' ? 'ASSIGNED' : requestedStatus;
        const complaintTaskId = assignee
            ? await createComplaintTask(tx, tenantId, userId, complaint, assignee)
            : metadata.complaintTaskId || null;

        const nextMetadata = {
            ...metadata,
            assignedTo: assignee?.name || assignedTo || null,
            assignedStaffId: assignee?.staffId || metadata.assignedStaffId || null,
            assignedStaffName: assignee?.name || metadata.assignedStaffName || null,
            complaintTaskId,
            resolutionNotes: resolutionNotes || metadata.resolutionNotes || null,
            lastWorkflowActionBy: userId,
            lastWorkflowActionAt: now
        };

        if (effectiveStatus === 'ASSIGNED') {
            nextMetadata.assignedAt = metadata.assignedAt || now;
            nextMetadata.assignedBy = userId;
        }

        if (effectiveStatus === 'RESOLVED') {
            nextMetadata.resolvedAt = metadata.resolvedAt || now;
            nextMetadata.resolvedBy = userId;
        }

        if (effectiveStatus === 'CLOSED') {
            nextMetadata.closedAt = metadata.closedAt || now;
            nextMetadata.closedBy = userId;
        }

        const updated = await tx.complaint.update({
            where: { id: complaint.id },
            data: {
                status: effectiveStatus,
                metadata: nextMetadata
            }
        });

        await tx.workflowLog.create({
            data: {
                entityType: 'COMPLAINT',
                entityId: complaint.id,
                fromState: complaint.status,
                toState: effectiveStatus,
                actionBy: userId,
                notes: resolutionNotes || (assignee ? `Assigned to ${assignee.name}` : 'Complaint workflow updated'),
                tenantId,
                unitId: complaint.unitId
            }
        });

        return updated;
    });
};

export const getServiceHistory = async (tenantId, unitId) => {
    const where = {
        tenantId,
        isDeleted: false,
        status: 'COMPLETED'
    };

    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }

    const allocations = await prisma.allocation.findMany({
        where,
        include: {
            enquiry: {
                include: {
                    client: true,
                    service: true
                }
            },
            staff: {
                select: {
                    firstName: true,
                    lastName: true,
                    empId: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    const allocationIds = allocations.map((allocation) => allocation.id);
    const transactions = allocationIds.length
        ? await prisma.accountTransaction.findMany({
            where: {
                tenantId,
                allocationId: { in: allocationIds },
                type: { in: ['INVOICE', 'RECEIPT'] },
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        })
        : [];

    const transactionsByAllocation = new Map();
    transactions.forEach((transaction) => {
        if (!transactionsByAllocation.has(transaction.allocationId)) {
            transactionsByAllocation.set(transaction.allocationId, []);
        }
        transactionsByAllocation.get(transaction.allocationId).push(transaction);
    });

    const invoiceIds = transactions
        .filter((transaction) => transaction.type === 'INVOICE')
        .map((transaction) => transaction.id);
    let dailyCostRows = [];
    if (invoiceIds.length) {
        try {
            dailyCostRows = await prisma.$queryRaw`
                SELECT
                    "invoiceId",
                    "costNo",
                    "costDate",
                    "category",
                    "description",
                    "quantity",
                    "rate",
                    "amount"
                FROM "PatientDailyCost"
                WHERE "tenantId" = ${tenantId}
                  AND "invoiceId" = ANY(${invoiceIds})
                  AND "isDeleted" = false
                ORDER BY "costDate" ASC, "createdAt" ASC
            `;
        } catch (error) {
            dailyCostRows = [];
        }
    }
    const dailyCostsByInvoice = new Map();
    dailyCostRows.forEach((item) => {
        if (!dailyCostsByInvoice.has(item.invoiceId)) {
            dailyCostsByInvoice.set(item.invoiceId, []);
        }
        dailyCostsByInvoice.get(item.invoiceId).push(item);
    });

    const feedbacks = allocationIds.length
        ? await prisma.feedback.findMany({
            where: {
                tenantId,
                allocationId: { in: allocationIds },
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        })
        : [];

    const feedbackByAllocation = new Map();
    feedbacks.forEach((feedback) => {
        if (!feedbackByAllocation.has(feedback.allocationId)) {
            feedbackByAllocation.set(feedback.allocationId, feedback);
        }
    });

    const metadataComplaintIds = allocations
        .map((allocation) => {
            const metadata = allocation.metadata && typeof allocation.metadata === 'object' ? allocation.metadata : {};
            return metadata.feedbackComplaintId;
        })
        .filter(Boolean);

    const complaints = metadataComplaintIds.length
        ? await prisma.complaint.findMany({
            where: {
                tenantId,
                id: { in: metadataComplaintIds },
                isDeleted: false
            },
            select: {
                id: true,
                refNo: true,
                status: true,
                updatedAt: true
            }
        })
        : [];

    const complaintById = new Map();
    complaints.forEach((complaint) => {
        complaintById.set(complaint.id, complaint);
    });

    const enquiryIds = allocations
        .map((allocation) => allocation.enquiryId)
        .filter(Boolean);

    const renewalFollowUps = enquiryIds.length
        ? await prisma.followUp.findMany({
            where: {
                tenantId,
                enquiryId: { in: enquiryIds },
                isDeleted: false,
                OR: [
                    { clientInterest: 'Renewal Follow-up' },
                    { nextFollowupStatus: { startsWith: 'RENEWAL' } }
                ]
            },
            orderBy: { updatedAt: 'desc' }
        })
        : [];

    const renewalFollowUpByEnquiry = new Map();
    renewalFollowUps.forEach((followUp) => {
        if (!renewalFollowUpByEnquiry.has(followUp.enquiryId)) {
            renewalFollowUpByEnquiry.set(followUp.enquiryId, followUp);
        }
    });

    const clientIds = allocations
        .map((allocation) => allocation.enquiry?.client?.id)
        .filter(Boolean);

    const renewalConvertedEnquiries = clientIds.length
        ? await prisma.enquiry.findMany({
            where: {
                tenantId,
                clientId: { in: clientIds },
                source: 'Renewal Follow-up',
                isDeleted: false
            },
            select: {
                id: true,
                refNo: true,
                clientId: true,
                rawMessage: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        })
        : [];

    const convertedEnquiryBySource = new Map();
    renewalConvertedEnquiries.forEach((enquiry) => {
        const meta = parseJsonObject(enquiry.rawMessage);
        const sourceEnquiryId = meta.renewalSourceEnquiryId;
        if (sourceEnquiryId && !convertedEnquiryBySource.has(sourceEnquiryId)) {
            convertedEnquiryBySource.set(sourceEnquiryId, enquiry);
        }
    });

    return allocations.map((allocation) => {
        const metadata = allocation.metadata && typeof allocation.metadata === 'object' ? allocation.metadata : {};
        const latestServiceHistory = Array.isArray(metadata.serviceHistory) ? metadata.serviceHistory[0] : null;
        const allocationTransactions = transactionsByAllocation.get(allocation.id) || [];
        const invoice = allocationTransactions.find((transaction) => transaction.type === 'INVOICE') || null;
        const receipt = allocationTransactions.find((transaction) => transaction.type === 'RECEIPT') || null;
        const invoiceMetadata = invoice?.metadata && typeof invoice.metadata === 'object' ? invoice.metadata : {};
        const receiptMetadata = receipt?.metadata && typeof receipt.metadata === 'object' ? receipt.metadata : {};
        const paymentStatus = invoiceMetadata.paymentStatus || receiptMetadata.paymentStatus || metadata.paymentStatus || 'PENDING';
        const invoiceAmount = invoice ? Number(invoice.amount || 0) : 0;
        const balanceAmount = Number(invoiceMetadata.balanceAmount ?? receiptMetadata.balanceAmount ?? metadata.balanceAmount ?? (paymentStatus === 'PAID' ? 0 : invoiceAmount));
        const amountToPay = paymentStatus === 'PAID' ? 0 : (balanceAmount > 0 ? balanceAmount : invoiceAmount);
        const billingItems = invoice?.id ? (dailyCostsByInvoice.get(invoice.id) || []) : [];
        const feedback = feedbackByAllocation.get(allocation.id) || null;
        const feedbackRating = feedback ? Number(feedback.rating || 0) : Number(metadata.feedbackRating || 0);
        const feedbackStatus = feedback || metadata.feedbackStatus === 'COLLECTED'
            ? 'COLLECTED'
            : (paymentStatus === 'PAID' ? 'PENDING' : 'WAITING_PAYMENT');
        const complaint = metadata.feedbackComplaintId
            ? complaintById.get(metadata.feedbackComplaintId) || null
            : null;
        const staffName = allocation.staff
            ? `${allocation.staff.firstName} ${allocation.staff.lastName || ''}`.trim()
            : latestServiceHistory?.staffName;
        const renewalFollowUp = renewalFollowUpByEnquiry.get(allocation.enquiryId) || null;
        const renewalStatus = renewalFollowUp?.nextFollowupStatus || metadata.renewalFollowUpStatus || null;
        const convertedEnquiry = convertedEnquiryBySource.get(allocation.enquiryId) || null;

        return {
            id: allocation.id,
            enquiryId: allocation.enquiry?.id || allocation.enquiryId || null,
            ref: allocation.enquiry?.refNo || allocation.refNo,
            allocationRef: allocation.refNo,
            service: allocation.enquiry?.service?.name || `${allocation.type.replace(/_/g, ' ')} Care`,
            clientName: allocation.enquiry?.client?.name || metadata.patientName || 'Client',
            patientName: metadata.patientName || allocation.enquiry?.client?.name || null,
            status: allocation.status,
            allocatedDetails: staffName
                ? `${staffName}${allocation.staff?.empId ? ` (${allocation.staff.empId})` : ''}`
                : 'Staff pending',
            careType: allocation.type,
            completedAt: metadata.serviceDeliveredAt || latestServiceHistory?.approvedAt || allocation.endDate,
            taskRefNo: latestServiceHistory?.taskRefNo || null,
            notes: latestServiceHistory?.notes || metadata.notes || null,
            invoiceNo: invoice?.refNo || metadata.invoiceRefNo || null,
            receiptNo: receipt?.refNo || metadata.receiptRefNo || null,
            invoiceAmount,
            amountToPay,
            paidAmount: receipt ? Number(receipt.amount || 0) : Number(metadata.paidAmount || 0),
            balanceAmount,
            paymentMode: receipt?.paymentMode || invoice?.paymentMode || null,
            paymentStatus,
            invoiceNotes: invoice?.notes || null,
            billingItems: billingItems.map((item) => ({
                costNo: item.costNo,
                costDate: item.costDate,
                category: item.category,
                description: item.description,
                quantity: Number(item.quantity || 0),
                rate: Number(item.rate || 0),
                amount: Number(item.amount || 0)
            })),
            workflowClosedAt: metadata.workflowClosedAt || invoiceMetadata.lastPaymentAt || receipt?.createdAt || null,
            feedbackId: feedback?.id || null,
            feedbackStatus,
            feedbackRating: feedbackRating || null,
            feedbackComments: feedback?.comments || metadata.feedbackComments || null,
            feedbackAt: feedback?.createdAt || metadata.feedbackAt || null,
            complaintId: complaint?.id || metadata.feedbackComplaintId || null,
            complaintRefNo: complaint?.refNo || metadata.feedbackComplaintRefNo || null,
            complaintStatus: complaint?.status || metadata.feedbackComplaintStatus || null,
            complaintUpdatedAt: complaint?.updatedAt || null,
            renewalFollowUpId: renewalFollowUp?.id || metadata.renewalFollowUpId || null,
            renewalFollowUpStatus: renewalStatus,
            renewalFollowUpOutcome: renewalFollowUp?.outcome || null,
            renewalFollowUpNotes: renewalFollowUp?.notes || metadata.renewalFollowUpNotes || null,
            renewalFollowUpScheduledAt: renewalFollowUp?.scheduledAt || metadata.renewalFollowUpScheduledAt || null,
            renewalFollowUpAt: renewalFollowUp?.updatedAt || metadata.renewalFollowUpAt || null,
            renewalConvertedEnquiryId: convertedEnquiry?.id || metadata.renewalConvertedEnquiryId || null,
            renewalConvertedEnquiryRefNo: convertedEnquiry?.refNo || metadata.renewalConvertedEnquiryRefNo || null,
            finalClosureStatus: feedbackStatus === 'COLLECTED' ? 'CUSTOMER_CLOSED' : 'AWAITING_FEEDBACK'
        };
    }).filter((item) => ![
        item.id,
        item.ref,
        item.allocationRef,
        item.taskRefNo
    ].some(isDemoOrSeedIdentifier));
};

export const createRenewalFollowUp = async (tenantId, unitId, userId, allocationId, data = {}) => {
    const result = await prisma.$transaction(async (tx) => {
        const where = {
            id: allocationId,
            tenantId,
            isDeleted: false
        };

        if (unitId && unitId !== 'ALL') {
            where.unitId = unitId;
        }

        const allocation = await tx.allocation.findFirst({
            where,
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
            const error = new Error('Completed service not found or unauthorized');
            error.status = 404;
            throw error;
        }

        if (!allocation.enquiryId) {
            const error = new Error('Renewal follow-up requires a linked enquiry');
            error.status = 400;
            throw error;
        }

        const metadata = allocation.metadata && typeof allocation.metadata === 'object' ? allocation.metadata : {};
        if (metadata.renewalFollowUpId) {
            const existingFollowUp = await tx.followUp.findFirst({
                where: {
                    id: metadata.renewalFollowUpId,
                    tenantId,
                    isDeleted: false
                }
            });

            if (existingFollowUp) {
                return {
                    followUp: existingFollowUp,
                    allocation,
                    alreadyExists: true
                };
            }
        }

        const requestedDate = data.nextDate || data.scheduledAt || metadata.renewalFollowUpScheduledAt;
        const fallbackDate = metadata.workflowClosedAt || metadata.feedbackAt || allocation.endDate || allocation.updatedAt || new Date();
        const scheduledAt = requestedDate ? new Date(requestedDate) : new Date(fallbackDate);
        if (Number.isNaN(scheduledAt.getTime())) {
            const error = new Error('Invalid renewal follow-up date');
            error.status = 400;
            throw error;
        }

        if (!requestedDate) {
            scheduledAt.setDate(scheduledAt.getDate() + 30);
        }

        const serviceName = allocation.enquiry?.service?.name || `${allocation.type.replace(/_/g, ' ')} Care`;
        const clientName = allocation.enquiry?.client?.name || metadata.patientName || 'Client';
        const notes = String(data.notes || '').trim()
            || `Renewal follow-up for ${clientName} after ${serviceName} service ${allocation.refNo}`;

        const followUp = await tx.followUp.create({
            data: {
                enquiryId: allocation.enquiryId,
                notes,
                scheduledAt,
                channel: data.channel || 'CALL',
                outcome: 'PENDING',
                clientInterest: 'Renewal Follow-up',
                nextFollowupStatus: 'RENEWAL',
                tenantId,
                unitId: allocation.unitId
            }
        });

        const now = new Date();
        const updatedAllocation = await tx.allocation.update({
            where: { id: allocation.id },
            data: {
                metadata: {
                    ...metadata,
                    renewalFollowUpId: followUp.id,
                    renewalFollowUpStatus: 'CREATED',
                    renewalFollowUpScheduledAt: scheduledAt,
                    renewalFollowUpAt: now,
                    renewalFollowUpNotes: notes
                }
            }
        });

        await tx.workflowLog.create({
            data: {
                entityType: 'ALLOCATION',
                entityId: allocation.id,
                fromState: metadata.renewalFollowUpStatus || metadata.finalClosureStatus || 'CUSTOMER_CLOSED',
                toState: 'RENEWAL_FOLLOW_UP_CREATED',
                actionBy: userId,
                notes,
                tenantId,
                unitId: allocation.unitId
            }
        });

        return {
            followUp,
            allocation: updatedAllocation,
            enquiryRefNo: allocation.enquiry?.refNo || null,
            clientName
        };
    });
};

export const getPendingFeedbackServices = async (tenantId, unitId) => {
    const history = await getServiceHistory(tenantId, unitId);
    return history.filter((item) => item.paymentStatus === 'PAID' && item.feedbackStatus !== 'COLLECTED');
};

export const recordServiceFeedback = async (tenantId, unitId, userId, allocationId, data) => {
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        const error = new Error('Feedback rating must be between 1 and 5');
        error.status = 400;
        throw error;
    }

    await ensurePatientBillingTables();

    return prisma.$transaction(async (tx) => {
        const where = {
            id: allocationId,
            tenantId,
            isDeleted: false
        };

        if (unitId && unitId !== 'ALL') {
            where.unitId = unitId;
        }

        const allocation = await tx.allocation.findFirst({
            where,
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
            const error = new Error('Completed service not found or unauthorized');
            error.status = 404;
            throw error;
        }

        const metadata = allocation.metadata && typeof allocation.metadata === 'object' ? allocation.metadata : {};
        const existingFeedback = await tx.feedback.findFirst({
            where: {
                tenantId,
                allocationId: allocation.id,
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        });

        const feedback = existingFeedback
            ? await tx.feedback.update({
                where: { id: existingFeedback.id },
                data: {
                    rating,
                    comments: data.comments || null
                }
            })
            : await tx.feedback.create({
                data: {
                    allocationId: allocation.id,
                    rating,
                    comments: data.comments || null,
                    tenantId,
                    unitId: allocation.unitId
                }
            });

        let complaint = null;
        if (rating <= 2 && !metadata.feedbackComplaintId) {
            const refNo = await generateRef('CMP', tenantId, allocation.unitId, tx);
            complaint = await tx.complaint.create({
                data: {
                    refNo,
                    title: `Low feedback from ${allocation.enquiry?.client?.name || metadata.patientName || 'Client'}`,
                    type: 'Service Feedback',
                    description: data.comments || `Low customer rating (${rating}/5) after service closure.`,
                    status: 'OPEN',
                    priority: rating === 1 ? 'Critical' : 'High',
                    sentiment: 'NEGATIVE',
                    urgency: rating === 1 ? 'CRITICAL' : 'HIGH',
                    serviceTag: allocation.enquiry?.service?.name || allocation.type,
                    metadata: {
                        source: 'SERVICE_FEEDBACK',
                        allocationId: allocation.id,
                        feedbackId: feedback.id,
                        rating,
                        clientName: allocation.enquiry?.client?.name || metadata.patientName || 'Client',
                        service: allocation.enquiry?.service?.name || allocation.type
                    },
                    tenantId,
                    unitId: allocation.unitId
                }
            });
        }

        const feedbackAt = new Date();
        const updatedAllocation = await tx.allocation.update({
            where: { id: allocation.id },
            data: {
                metadata: {
                    ...metadata,
                    feedbackStatus: 'COLLECTED',
                    feedbackRating: rating,
                    feedbackComments: data.comments || null,
                    feedbackAt,
                    finalClosureStatus: 'CUSTOMER_CLOSED',
                    feedbackComplaintId: complaint?.id || metadata.feedbackComplaintId || null,
                    feedbackComplaintRefNo: complaint?.refNo || metadata.feedbackComplaintRefNo || null
                }
            }
        });

        await tx.workflowLog.create({
            data: {
                entityType: 'ALLOCATION',
                entityId: allocation.id,
                fromState: metadata.feedbackStatus || 'AWAITING_FEEDBACK',
                toState: 'CUSTOMER_CLOSED',
                actionBy: userId,
                notes: `Customer feedback recorded with rating ${rating}/5${complaint ? ` and complaint ${complaint.refNo} created` : ''}`,
                tenantId,
                unitId: allocation.unitId
            }
        });

        return {
            feedback,
            complaint,
            allocation: updatedAllocation,
            feedbackAt
        };
    });

    let billingSync = null;
    try {
        billingSync = await prisma.$transaction(async (tx) => {
            const syncResult = await reconcileAllocationCompletionBilling(tx, {
                tenantId,
                allocationId,
                completedAt: result.feedbackAt,
                createdBy: userId
            });

            const latestAllocation = await tx.allocation.findFirst({
                where: {
                    id: allocationId,
                    tenantId,
                    isDeleted: false
                },
                select: {
                    id: true,
                    metadata: true
                }
            });

            if (latestAllocation) {
                const latestMetadata = latestAllocation.metadata && typeof latestAllocation.metadata === 'object'
                    ? latestAllocation.metadata
                    : {};
                await tx.allocation.update({
                    where: { id: latestAllocation.id },
                    data: {
                        metadata: {
                            ...latestMetadata,
                            enquiryCompletionBillingSyncedAt: new Date(),
                            enquiryCompletionBillingSync: syncResult
                        }
                    }
                });
            }

            return syncResult;
        }, {
            maxWait: 10000,
            timeout: 60000
        });
    } catch (error) {
        console.warn('[CustomerCare] feedback saved but enquiry completion billing sync failed', error?.message || error);
        billingSync = {
            failed: true,
            message: error?.message || 'Billing sync failed after feedback save'
        };
    }

    return {
        ...result,
        billingSync
    };
};
