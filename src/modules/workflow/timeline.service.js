import { prisma } from '../../app/prisma.js';

const toIso = (value) => value ? new Date(value).toISOString() : null;

const isDone = (value) => [
    'CLOSED',
    'COMPLETED',
    'APPROVED',
    'POSTED',
    'ACTIVE',
    'PAID',
    'CUSTOMER_CLOSED',
    'WORKFLOW_CLOSED',
    'COLLECTED',
    'RENEWAL_INTERESTED',
    'RENEWAL_NOT_INTERESTED',
    'RENEWAL_CALL_LATER',
    'RENEWAL_CONVERTED_TO_NEW_SERVICE',
    'RENEWAL_CLOSED',
    'RENEWAL_CREATED',
    'CONVERTED_TO_NEW_SERVICE',
    'NOT_REQUIRED'
].includes(String(value || '').toUpperCase());

const normalizeStatus = (value, fallback = 'PENDING') => String(value || fallback).replace(/_/g, ' ');

const buildStage = ({ key, label, status, at, ref, owner, detail, complete, nextRoute, actionLabel }) => ({
    key,
    label,
    status: normalizeStatus(status),
    at: toIso(at),
    ref: ref || null,
    owner: owner || null,
    detail: detail || null,
    complete: typeof complete === 'boolean' ? complete : isDone(status),
    nextRoute: nextRoute || null,
    actionLabel: actionLabel || null
});

const latestByDate = (items, field = 'updatedAt') => {
    return [...items].sort((a, b) => new Date(b?.[field] || 0).getTime() - new Date(a?.[field] || 0).getTime())[0] || null;
};

const staffName = (staff) => staff ? `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.empId : null;

const userName = (user) => user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || user.id : null;

const isFollowUpTask = (task) => {
    const title = String(task?.title || '').toLowerCase();
    const description = String(task?.description || '').toLowerCase();
    return title.includes('client follow-up') || description.includes('lead quality') || description.includes('follow-up priority');
};

const buildSearchWhere = (search) => {
    const query = String(search || '').trim();
    if (!query) return {};

    const statusFilters = ['NEW', 'FOLLOW_UP', 'IN_PROGRESS', 'CLOSED'].includes(query.toUpperCase())
        ? [{ status: { equals: query.toUpperCase() } }]
        : [];

    return {
        OR: [
            { refNo: { contains: query, mode: 'insensitive' } },
            ...statusFilters,
            { client: { name: { contains: query, mode: 'insensitive' } } },
            { client: { mobile: { contains: query } } },
            { client: { email: { contains: query, mode: 'insensitive' } } }
        ]
    };
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

const buildExpandedSearchWhere = async ({ tenantId, unitId, search }) => {
    const baseWhere = buildSearchWhere(search);
    const query = String(search || '').trim();
    if (!query) return baseWhere;

    const scopedWhere = { tenantId, isDeleted: false };
    if (unitId && unitId !== 'ALL') {
        scopedWhere.unitId = unitId;
    }

    const [matchingAllocations, matchingTransactions, matchingTasks] = await Promise.all([
        prisma.allocation.findMany({
            where: {
                ...scopedWhere,
                refNo: { contains: query, mode: 'insensitive' }
            },
            select: {
                enquiryId: true
            },
            take: 50
        }),
        prisma.accountTransaction.findMany({
            where: {
                ...scopedWhere,
                refNo: { contains: query, mode: 'insensitive' }
            },
            select: {
                allocation: {
                    select: {
                        enquiryId: true
                    }
                }
            },
            take: 50
        }),
        prisma.task.findMany({
            where: {
                ...scopedWhere,
                OR: [
                    { id: query },
                    { refNo: { contains: query, mode: 'insensitive' } },
                    { title: { contains: query, mode: 'insensitive' } }
                ]
            },
            select: {
                enquiryId: true
            },
            take: 50
        })
    ]);

    const linkedEnquiryIds = [
        ...matchingAllocations.map((allocation) => allocation.enquiryId),
        ...matchingTransactions.map((transaction) => transaction.allocation?.enquiryId),
        ...matchingTasks.map((task) => task.enquiryId)
    ].filter(Boolean);

    if (linkedEnquiryIds.length === 0) {
        return baseWhere;
    }

    return {
        OR: [
            ...(baseWhere.OR || []),
            { id: { in: [...new Set(linkedEnquiryIds)] } }
        ]
    };
};

export const listWorkflowTimelines = async ({ tenantId, unitId, search, limit }) => {
    const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const where = {
        tenantId,
        isDeleted: false,
        ...await buildExpandedSearchWhere({ tenantId, unitId, search })
    };

    if (unitId && unitId !== 'ALL') {
        where.unitId = unitId;
    }

    const enquiries = await prisma.enquiry.findMany({
        where,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
            client: true,
            service: true,
            admission: {
                include: {
                    patient: true
                }
            },
            allocation: {
                include: {
                    staff: true
                }
            },
            tasks: {
                include: {
                    assignedStaff: true,
                    assignee: {
                        include: {
                            staff: true
                        }
                    },
                    approvalAuthority: {
                        include: {
                            staff: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            },
            followUps: {
                orderBy: { createdAt: 'desc' },
                take: 20
            }
        }
    });

    const enquiryIds = enquiries.map((enquiry) => enquiry.id).filter(Boolean);
    const allocationIds = enquiries.map((enquiry) => enquiry.allocation?.id).filter(Boolean);
    const taskIds = enquiries.flatMap((enquiry) => enquiry.tasks.map((task) => task.id)).filter(Boolean);
    const invoices = allocationIds.length
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

    const followUpIds = enquiries.flatMap((enquiry) => enquiry.followUps.map((followUp) => followUp.id)).filter(Boolean);

    const renewalConvertedEnquiries = enquiryIds.length
        ? await prisma.enquiry.findMany({
            where: {
                tenantId,
                source: 'Renewal Follow-up',
                isDeleted: false
            },
            select: {
                id: true,
                refNo: true,
                rawMessage: true,
                createdAt: true,
                unitId: true
            },
            orderBy: { createdAt: 'desc' }
        })
        : [];

    const convertedEnquiryBySource = new Map();
    renewalConvertedEnquiries.forEach((convertedEnquiry) => {
        const meta = parseJsonObject(convertedEnquiry.rawMessage);
        const sourceEnquiryId = meta.renewalSourceEnquiryId;
        if (sourceEnquiryId && enquiryIds.includes(sourceEnquiryId) && !convertedEnquiryBySource.has(sourceEnquiryId)) {
            convertedEnquiryBySource.set(sourceEnquiryId, convertedEnquiry);
        }
    });

    const convertedEnquiryIds = [...convertedEnquiryBySource.values()].map((enquiry) => enquiry.id).filter(Boolean);
    const transactionIds = invoices.map((transaction) => transaction.id).filter(Boolean);
    const workflowEntityIds = [...enquiryIds, ...allocationIds, ...taskIds, ...followUpIds, ...transactionIds, ...convertedEnquiryIds];
    const workflowLogs = workflowEntityIds.length
        ? await prisma.workflowLog.findMany({
            where: {
                tenantId,
                entityId: { in: workflowEntityIds },
                isDeleted: false
            },
            orderBy: { createdAt: 'asc' }
        })
        : [];

    const actionUserIds = [...new Set(workflowLogs.map((log) => log.actionBy).filter(Boolean))];
    const actionUsers = actionUserIds.length
        ? await prisma.user.findMany({
            where: {
                id: { in: actionUserIds }
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
            }
        })
        : [];

    const usersById = new Map(actionUsers.map((user) => [user.id, user]));

    const logsByEntityId = new Map();
    workflowLogs.forEach((log) => {
        if (!logsByEntityId.has(log.entityId)) {
            logsByEntityId.set(log.entityId, []);
        }
        logsByEntityId.get(log.entityId).push(log);
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

    const complaintIds = allocationIds
        .map((allocationId) => {
            const enquiry = enquiries.find((item) => item.allocation?.id === allocationId);
            const metadata = enquiry?.allocation?.metadata && typeof enquiry.allocation.metadata === 'object' ? enquiry.allocation.metadata : {};
            return metadata.feedbackComplaintId || null;
        })
        .filter(Boolean);

    const complaints = complaintIds.length
        ? await prisma.complaint.findMany({
            where: {
                tenantId,
                id: { in: complaintIds },
                isDeleted: false
            },
            select: {
                id: true,
                refNo: true,
                status: true,
                priority: true,
                metadata: true,
                createdAt: true,
                updatedAt: true
            }
        })
        : [];

    const complaintsById = new Map(complaints.map((complaint) => [complaint.id, complaint]));
    const complaintTaskIds = complaints
        .map((complaint) => {
            const metadata = complaint.metadata && typeof complaint.metadata === 'object' ? complaint.metadata : {};
            return metadata.complaintTaskId || null;
        })
        .filter(Boolean);
    const complaintTasks = complaintTaskIds.length
        ? await prisma.task.findMany({
            where: {
                tenantId,
                id: { in: complaintTaskIds },
                isDeleted: false
            },
            include: {
                assignedStaff: true,
                assignee: {
                    include: {
                        staff: true
                    }
                }
            }
        })
        : [];
    const complaintTasksById = new Map(complaintTasks.map((task) => [task.id, task]));

    const transactionsByAllocation = new Map();
    invoices.forEach((transaction) => {
        if (!transactionsByAllocation.has(transaction.allocationId)) {
            transactionsByAllocation.set(transaction.allocationId, []);
        }
        transactionsByAllocation.get(transaction.allocationId).push(transaction);
    });

    return enquiries.map((enquiry) => {
        const rawAllocation = enquiry.allocation;
        const rawAllocationMetadata = rawAllocation?.metadata && typeof rawAllocation.metadata === 'object' ? rawAllocation.metadata : {};
        const isLegacyFollowUpAllocation = Boolean(
            rawAllocation &&
            rawAllocationMetadata.latestFollowUpTaskId &&
            rawAllocationMetadata.followUpChannel &&
            !rawAllocationMetadata.handoffSource &&
            !rawAllocationMetadata.admissionId
        );
        const allocation = isLegacyFollowUpAllocation ? null : rawAllocation;
        const allocationMetadata = allocation?.metadata && typeof allocation.metadata === 'object' ? allocation.metadata : {};
        const latestTask = latestByDate(enquiry.tasks);
        const approvedTask = enquiry.tasks.find((task) => ['APPROVED', 'COMPLETED'].includes(String(task.status).toUpperCase()));
        const allocationTransactions = allocation ? transactionsByAllocation.get(allocation.id) || [] : [];
        const allocationInvoices = allocationTransactions.filter((transaction) => transaction.type === 'INVOICE');
        const allocationReceipts = allocationTransactions.filter((transaction) => transaction.type === 'RECEIPT');
        const latestInvoice = latestByDate(allocationInvoices, 'createdAt');
        const latestReceipt = latestByDate(allocationReceipts, 'createdAt');
        const invoiceMetadata = latestInvoice?.metadata && typeof latestInvoice.metadata === 'object' ? latestInvoice.metadata : {};
        const receiptMetadata = latestReceipt?.metadata && typeof latestReceipt.metadata === 'object' ? latestReceipt.metadata : {};
        const paymentStatus = invoiceMetadata.paymentStatus || receiptMetadata.paymentStatus || (latestReceipt ? 'PARTIAL' : 'PENDING');
        const isFullyPaid = paymentStatus === 'PAID';
        const feedback = allocation ? feedbackByAllocation.get(allocation.id) || null : null;
        const complaint = allocationMetadata.feedbackComplaintId ? complaintsById.get(allocationMetadata.feedbackComplaintId) || null : null;
        const feedbackStatus = feedback || allocationMetadata.feedbackStatus === 'COLLECTED'
            ? 'COLLECTED'
            : (isFullyPaid ? 'PENDING' : 'WAITING_PAYMENT');
        const finalClosureStatus = feedbackStatus === 'COLLECTED' ? 'CUSTOMER_CLOSED' : (isFullyPaid ? 'AWAITING_FEEDBACK' : 'PENDING');
        const renewalFollowUp = enquiry.followUps.find((followUp) => (
            String(followUp.nextFollowupStatus || '').startsWith('RENEWAL') ||
            String(followUp.clientInterest || '').toLowerCase() === 'renewal follow-up' ||
            String(followUp.clientInterest || '').toLowerCase() === 'call later' ||
            String(followUp.clientInterest || '').toLowerCase() === 'interested'
        )) || null;
        const renewalStatus = renewalFollowUp?.nextFollowupStatus || allocationMetadata.renewalFollowUpStatus || 'PENDING';
        const convertedEnquiry = convertedEnquiryBySource.get(enquiry.id) || null;
        const hasRenewalOutcome = Boolean(
            renewalFollowUp &&
            renewalStatus &&
            !['RENEWAL', 'CREATED'].includes(String(renewalStatus).toUpperCase())
        );
        const auditEntityIds = [
            enquiry.id,
            allocation?.id,
            ...enquiry.followUps.map((followUp) => followUp.id),
            ...enquiry.tasks.map((task) => task.id),
            ...allocationTransactions.map((transaction) => transaction.id),
            convertedEnquiry?.id
        ].filter(Boolean);
        const auditTrail = auditEntityIds
            .flatMap((entityId) => logsByEntityId.get(entityId) || [])
            .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
            .map((log) => ({
                id: log.id,
                entityType: log.entityType,
                entityId: log.entityId,
                fromState: log.fromState || null,
                toState: log.toState,
                actionBy: log.actionBy,
                actionByName: userName(usersById.get(log.actionBy)) || log.actionBy || 'System',
                notes: log.notes || null,
                createdAt: toIso(log.createdAt)
            }));

        const complaintMetadata = complaint?.metadata && typeof complaint.metadata === 'object' ? complaint.metadata : {};
        const complaintTask = complaintMetadata.complaintTaskId ? complaintTasksById.get(complaintMetadata.complaintTaskId) || null : null;
        const hasLowRatingComplaintPath = Boolean(complaint || Number(feedback?.rating || allocationMetadata.feedbackRating || 0) <= 2);
        const followUpTask = enquiry.tasks.find((task) => isFollowUpTask(task));
        const operationalTasks = enquiry.tasks.filter((task) => !isFollowUpTask(task));
        const latestOperationalTask = latestByDate(operationalTasks);
        const dutyCompletionTask = operationalTasks.find((task) => ['COMPLETED', 'APPROVED'].includes(String(task.status).toUpperCase())) || latestOperationalTask;
        const approvedDutyTask = operationalTasks.find((task) => String(task.status).toUpperCase() === 'APPROVED');
        const dutyCompletionStatus = String(dutyCompletionTask?.status || '').toUpperCase();
        const dutySubmittedForApproval = dutyCompletionStatus === 'COMPLETED' && !approvedDutyTask;
        const complaintCompleted = ['COMPLETED', 'APPROVED'].includes(String(complaintTask?.status || '').toUpperCase());
        const complaintClosed = ['RESOLVED', 'CLOSED'].includes(String(complaint?.status || '').toUpperCase());
        const invoicePaymentStatus = isFullyPaid
            ? 'PAID'
            : latestInvoice?.status === 'POSTED'
                ? (latestReceipt ? paymentStatus : 'POSTED')
                : latestInvoice?.status || 'PENDING';

        const hasAnyFollowUp = enquiry.followUps.length > 0;
        const latestFollowUp = latestByDate(enquiry.followUps);
        const followUpStaffName = staffName(followUpTask?.assignedStaff || followUpTask?.assignee?.staff);
        const treatmentStaffName = staffName(dutyCompletionTask?.assignedStaff || dutyCompletionTask?.assignee?.staff || allocation?.staff);
        const hasHealthcareMonitoring = Boolean(
            allocation?.type === 'CLINICAL' ||
            allocation?.type === 'IN_HOUSE' ||
            enquiry.admission ||
            allocationMetadata.healthCondition ||
            allocationMetadata.patientName
        );
        const hasHealthcareActivity = Boolean(
            allocationMetadata.serviceDeliveredAt ||
            allocationMetadata.serviceDeliveredByTaskId ||
            approvedDutyTask
        );
        const routeSearchValue = allocation?.refNo || enquiry.refNo || enquiry.client?.name || '';
        const routeSearch = encodeURIComponent(routeSearchValue);
        const routeUnitId = encodeURIComponent(allocation?.unitId || enquiry.unitId || '');
        const workflowQuery = `unitId=${routeUnitId}&search=${routeSearch}`;
        const approvalPath = String(dutyCompletionTask?.type || '').toUpperCase() === 'SCHEDULED'
            ? '/task-log/schedule-approval'
            : '/task-log/daily-approval';
        const approvalQuery = dutyCompletionTask?.id
            ? `taskId=${encodeURIComponent(dutyCompletionTask.id)}&${workflowQuery}`
            : workflowQuery;

        const stages = [
            buildStage({
                key: 'enquiry',
                label: 'Enquiry',
                status: enquiry.status,
                at: enquiry.createdAt,
                ref: enquiry.refNo,
                owner: enquiry.client?.name,
                detail: enquiry.service?.name || enquiry.description || 'Client enquiry captured',
                complete: Boolean(enquiry.id),
                nextRoute: '/crm/enquiry-follow-up',
                actionLabel: 'Open Follow-up'
            }),
            buildStage({
                key: 'follow-up',
                label: 'Follow-up',
                status: hasAnyFollowUp ? latestFollowUp?.outcome || 'COMPLETED' : 'PENDING',
                at: latestFollowUp?.createdAt || latestFollowUp?.scheduledAt,
                ref: followUpTask?.refNo || latestFollowUp?.id,
                owner: followUpStaffName || latestFollowUp?.clientInterest || null,
                detail: followUpStaffName
                    ? `Follow-up staff: ${followUpStaffName}. ${latestFollowUp?.notes || 'Waiting for conversion decision'}`
                    : latestFollowUp?.notes || 'Waiting for enquiry follow-up and conversion decision',
                complete: hasAnyFollowUp,
                nextRoute: `/crm/active-enquiries?search=${encodeURIComponent(enquiry.refNo || enquiry.client?.name || '')}`,
                actionLabel: 'Convert To Admission'
            }),
            buildStage({
                key: 'admission',
                label: 'Admission',
                status: enquiry.admission ? enquiry.admission.status : 'PENDING',
                at: enquiry.admission?.createdAt,
                ref: enquiry.admission?.id,
                owner: enquiry.admission?.patient?.name,
                detail: enquiry.admission ? 'Admission record created from enquiry' : 'Waiting for admission conversion',
                complete: Boolean(enquiry.admission),
                nextRoute: `/crm/active-enquiries?search=${encodeURIComponent(enquiry.refNo || enquiry.client?.name || '')}`,
                actionLabel: 'Create Admission'
            }),
            buildStage({
                key: 'allocation',
                label: 'Allocation',
                status: allocation?.staffId ? 'ASSIGNED' : allocation ? 'PENDING_STAFF' : 'PENDING',
                at: allocation?.updatedAt || allocation?.createdAt,
                ref: allocation?.refNo,
                owner: treatmentStaffName || (allocation ? normalizeStatus(allocation.type, 'SERVICE') : null),
                detail: allocation?.staffId
                    ? `${normalizeStatus(allocation.type, 'SERVICE')} treatment/service staff: ${treatmentStaffName || 'assigned'}`
                    : allocation
                        ? 'Care allocation created and waiting for staff assignment'
                        : 'Waiting for allocation after admission handoff',
                complete: Boolean(allocation?.staffId),
                nextRoute: !allocation
                    ? `/crm/admission-tracking?search=${encodeURIComponent(enquiry.refNo || enquiry.client?.name || '')}`
                    : allocation?.type === 'CLINICAL'
                    ? `/allocation/clinical-care?unitId=${encodeURIComponent(allocation.unitId || '')}&search=${encodeURIComponent(allocation.refNo || enquiry.refNo || '')}`
                    : allocation?.type === 'IN_HOUSE'
                        ? `/allocation/inhouse-care?unitId=${encodeURIComponent(allocation.unitId || '')}&search=${encodeURIComponent(allocation.refNo || enquiry.refNo || '')}`
                        : allocation?.type === 'OTHERS'
                            ? `/allocation/others?unitId=${encodeURIComponent(allocation.unitId || '')}&search=${encodeURIComponent(allocation.refNo || enquiry.refNo || '')}`
                            : `/allocation/home-care?unitId=${encodeURIComponent(allocation?.unitId || '')}&search=${encodeURIComponent(allocation?.refNo || enquiry.refNo || '')}`,
                actionLabel: allocation ? 'Assign Staff' : 'Create Handoff'
            }),
            buildStage({
                key: 'staff-execution',
                label: 'Staff Execution',
                status: approvedDutyTask ? 'APPROVED' : dutySubmittedForApproval ? 'WAITING_APPROVAL' : dutyCompletionTask?.status || 'PENDING',
                at: approvedDutyTask?.updatedAt || dutyCompletionTask?.completedAt || dutyCompletionTask?.updatedAt,
                ref: approvedDutyTask?.refNo || dutyCompletionTask?.refNo,
                owner: treatmentStaffName,
                detail: approvedDutyTask
                    ? `Treatment/service duty approved for ${treatmentStaffName || 'assigned staff'} and handed to the next workflow step`
                    : dutySubmittedForApproval
                        ? `Treatment/service duty completed by ${treatmentStaffName || 'assigned staff'}; waiting for admin task approval`
                        : dutyCompletionTask?.title || 'Waiting for staff to start and complete assigned duty',
                complete: Boolean(approvedDutyTask),
                nextRoute: dutySubmittedForApproval
                    ? `${approvalPath}?${approvalQuery}`
                    : '/profile/tasks',
                actionLabel: dutySubmittedForApproval ? 'Open Approval' : 'Open Staff Tasks'
            }),
            buildStage({
                key: 'healthcare-monitoring',
                label: 'Healthcare Monitoring',
                status: hasHealthcareMonitoring ? (hasHealthcareActivity ? 'COMPLETED' : approvedDutyTask ? 'IN_PROGRESS' : 'WAITING_APPROVAL') : 'NOT_REQUIRED',
                at: allocationMetadata.serviceDeliveredAt || approvedDutyTask?.updatedAt,
                ref: enquiry.admission?.id || approvedDutyTask?.refNo || allocation?.refNo,
                owner: enquiry.admission?.patient?.name || allocationMetadata.patientName || staffName(allocation?.staff),
                detail: hasHealthcareMonitoring
                    ? approvedDutyTask
                        ? 'Patient care, vitals, medication, ADL, and clinical monitoring stage'
                        : 'Starts after admin approves the completed staff duty'
                    : 'No healthcare monitoring required for this service type',
                complete: !hasHealthcareMonitoring || hasHealthcareActivity,
                nextRoute: `/healthcare/patient-dashboard?${workflowQuery}`,
                actionLabel: 'Open Healthcare'
            }),
            buildStage({
                key: 'billing',
                label: 'Billing',
                status: invoicePaymentStatus,
                at: latestReceipt?.createdAt || latestInvoice?.createdAt,
                ref: latestReceipt?.refNo || latestInvoice?.refNo,
                owner: latestReceipt
                    ? `Paid Rs ${Number(latestReceipt.amount || 0).toFixed(2)}`
                    : latestInvoice
                        ? `Invoice Rs ${Number(latestInvoice.amount || 0).toFixed(2)}`
                        : null,
                detail: latestReceipt
                    ? `${latestReceipt.paymentMode || 'Cash'} receipt generated for ${receiptMetadata.invoiceRefNo || latestInvoice?.refNo || 'invoice'}`
                    : latestInvoice
                        ? latestInvoice.notes || latestInvoice.category
                        : 'Waiting for invoice draft, posting, or payment collection',
                complete: isFullyPaid,
                nextRoute: `/finance/invoice?${workflowQuery}`,
                actionLabel: 'Open Billing'
            }),
            buildStage({
                key: 'customer-care',
                label: 'Customer Care',
                status: feedbackStatus,
                at: feedback?.createdAt || allocationMetadata.feedbackAt,
                ref: feedback?.id || complaint?.refNo || null,
                owner: enquiry.client?.name,
                detail: feedbackStatus === 'COLLECTED'
                    ? `Feedback recorded${feedback?.rating ? ` with rating ${feedback.rating}/5` : ''}${complaint ? `, complaint ${complaint.refNo}` : ''}`
                    : isFullyPaid
                        ? 'Waiting for feedback collection and complaint handling if rating is low'
                        : 'Customer care starts after billing is completed',
                complete: feedbackStatus === 'COLLECTED' && (!complaint || complaintClosed),
                nextRoute: complaint
                    ? `/customer-care/complaints?${workflowQuery}`
                    : `/customer-care/pending-feedback?${workflowQuery}`,
                actionLabel: complaint ? 'Open Complaint' : 'Collect Feedback'
            }),
            buildStage({
                key: 'renewal',
                label: 'Renewal',
                status: renewalFollowUp || allocationMetadata.renewalFollowUpId ? 'RENEWAL_CREATED' : (feedbackStatus === 'COLLECTED' ? 'PENDING' : 'WAITING_CUSTOMER_CARE'),
                at: renewalFollowUp?.createdAt || allocationMetadata.renewalFollowUpAt,
                ref: renewalFollowUp?.id || allocationMetadata.renewalFollowUpId,
                owner: enquiry.client?.name,
                detail: renewalFollowUp?.notes || allocationMetadata.renewalFollowUpNotes || 'Waiting for renewal follow-up after customer closure',
                complete: Boolean(renewalFollowUp || allocationMetadata.renewalFollowUpId),
                nextRoute: `/finance/renewals?${workflowQuery}`,
                actionLabel: 'Open Renewal'
            }),
            buildStage({
                key: 'repeat-service',
                label: 'Repeat Service',
                status: convertedEnquiry ? 'CONVERTED_TO_NEW_SERVICE' : (hasRenewalOutcome ? 'CLOSED' : 'PENDING'),
                at: convertedEnquiry?.createdAt,
                ref: convertedEnquiry?.refNo,
                owner: enquiry.client?.name,
                detail: convertedEnquiry
                    ? `Repeat service created as new enquiry ${convertedEnquiry.refNo}`
                    : (hasRenewalOutcome ? 'Renewal closed without repeat service' : 'Waiting for renewal outcome'),
                complete: Boolean(convertedEnquiry) || hasRenewalOutcome,
                nextRoute: convertedEnquiry
                    ? `/crm/enquiry-follow-up?search=${encodeURIComponent(convertedEnquiry.refNo || routeSearchValue)}`
                    : `/finance/renewals?${workflowQuery}`,
                actionLabel: convertedEnquiry ? 'Open Repeat Enquiry' : 'Update Renewal'
            })
        ];

        const nextIncompleteStage = stages.find((stage) => !stage.complete);
        const lastCompleteStage = [...stages].reverse().find((stage) => stage.complete);

        return {
            id: enquiry.id,
            refNo: enquiry.refNo,
            clientName: enquiry.client?.name || 'Client',
            mobile: enquiry.client?.mobile || null,
            service: enquiry.service?.name || allocation?.type || 'Service',
            status: enquiry.status,
            unitId: enquiry.unitId,
            createdAt: toIso(enquiry.createdAt),
            updatedAt: toIso(enquiry.updatedAt),
            currentStep: nextIncompleteStage?.label || lastCompleteStage?.label || stages[0].label,
            openItems: stages.filter((stage) => !stage.complete).map((stage) => stage.label),
            nextAction: nextIncompleteStage
                ? {
                    label: nextIncompleteStage.actionLabel || `Open ${nextIncompleteStage.label}`,
                    route: nextIncompleteStage.nextRoute,
                    stageKey: nextIncompleteStage.key
                }
                : null,
            summary: {
                followUps: enquiry.followUps.length,
                tasks: enquiry.tasks.length,
                invoices: allocationInvoices.length,
                receipts: allocationReceipts.length,
                invoiceAmount: allocationInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0),
                paidAmount: allocationReceipts.reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0),
                balanceAmount: Number(invoiceMetadata.balanceAmount || 0),
                auditEvents: auditTrail.length,
                renewalFollowUps: renewalFollowUp ? 1 : 0,
                convertedRenewals: convertedEnquiry ? 1 : 0
            },
            renewal: {
                followUpId: renewalFollowUp?.id || allocationMetadata.renewalFollowUpId || null,
                status: renewalStatus,
                outcome: renewalFollowUp?.outcome || null,
                scheduledAt: toIso(renewalFollowUp?.scheduledAt || allocationMetadata.renewalFollowUpScheduledAt),
                notes: renewalFollowUp?.notes || allocationMetadata.renewalFollowUpNotes || null,
                convertedEnquiryId: convertedEnquiry?.id || null,
                convertedEnquiryRefNo: convertedEnquiry?.refNo || null,
                convertedAt: toIso(convertedEnquiry?.createdAt)
            },
            closure: {
                feedbackStatus,
                feedbackRating: feedback?.rating || allocationMetadata.feedbackRating || null,
                feedbackComments: feedback?.comments || allocationMetadata.feedbackComments || null,
                feedbackAt: toIso(feedback?.createdAt || allocationMetadata.feedbackAt),
                complaintRefNo: complaint?.refNo || allocationMetadata.feedbackComplaintRefNo || null,
                complaintStatus: complaint?.status || null,
                finalClosureStatus
            },
            auditTrail,
            stages
        };
    });
};
