import { prisma } from '../../app/prisma.js';
import pkg from '../../generated/prisma/index.js';
const { Prisma } = pkg;
import { getServiceHistory, recordServiceFeedback, createComplaint, getComplaints } from '../customer_care/service.js';

const normalize = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');
const medicationScheduleModule = 'HEALTHCARE_MEDICATION';
const medicationScheduleAction = 'MEDICATION_SCHEDULE';

const readNoteValue = (notes, label) => {
    const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*(.+)$`, 'im');
    return String(notes || '').match(pattern)?.[1]?.trim() || '';
};

const toPortalMedicationSchedule = (schedule, issueById) => {
    const payload = schedule.payload && typeof schedule.payload === 'object' && !Array.isArray(schedule.payload) ? schedule.payload : {};
    const issue = issueById.get(payload.medicineIssueId) || {};
    const times = Array.isArray(payload.times) ? payload.times : [];
    const administeredSlots = Array.isArray(payload.administeredSlots) ? payload.administeredSlots : [];
    const administeredHistory = Array.isArray(payload.administeredHistory) ? payload.administeredHistory : [];

    return {
        id: schedule.id,
        medicineIssueId: payload.medicineIssueId,
        medicineName: payload.medicineName || issue.productName || 'Medicine',
        patientName: payload.patientName || issue.issuedTo || 'Patient',
        dose: payload.dose || '-',
        frequency: payload.frequency || '-',
        times,
        administeredSlots,
        administeredHistory,
        pendingSlots: times.filter((slot) => !administeredSlots.includes(slot)),
        status: payload.status || 'SCHEDULED',
        startDate: payload.startDate || null,
        notes: payload.notes || '',
        issuedQuantity: issue.quantity || null,
        approvedBy: issue.approvedBy || null,
        approvedAt: issue.approvedAt || null,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
    };
};

const getUserContactWhere = (user) => {
    const email = normalize(user?.email);
    const mobile = normalizePhone(user?.mobile);
    const OR = [];

    if (email) OR.push({ email: { equals: email, mode: 'insensitive' } });
    if (mobile) OR.push({ mobile: { contains: mobile } });

    return OR;
};

const getPortalClients = async (user) => {
    const OR = getUserContactWhere(user);
    if (!OR.length) return [];

    return prisma.client.findMany({
        where: {
            tenantId: user.tenantId,
            isDeleted: false,
            OR
        },
        select: {
            id: true,
            refNo: true,
            name: true,
            mobile: true,
            email: true,
            unitId: true
        }
    });
};

const clientOwnsItem = (clientIds, item) => {
    if (!clientIds.size) return false;
    return clientIds.has(item.clientId) || clientIds.has(item.enquiryClientId);
};

const attachClientIdsToHistory = async (tenantId, history) => {
    const enquiryIds = [...new Set(history.map((item) => item.enquiryId).filter(Boolean))];
    if (!enquiryIds.length) return history;

    const enquiries = await prisma.enquiry.findMany({
        where: {
            tenantId,
            id: { in: enquiryIds },
            isDeleted: false
        },
        select: {
            id: true,
            clientId: true
        }
    });
    const clientByEnquiry = new Map(enquiries.map((enquiry) => [enquiry.id, enquiry.clientId]));

    return history.map((item) => ({
        ...item,
        enquiryClientId: clientByEnquiry.get(item.enquiryId) || null
    }));
};

const filterHistoryForUser = async (user) => {
    const clients = await getPortalClients(user);
    const clientIds = new Set(clients.map((client) => client.id));
    if (!clientIds.size) return { clients, history: [] };

    const history = await getServiceHistory(user.tenantId, 'ALL');
    const enrichedHistory = await attachClientIdsToHistory(user.tenantId, history);

    return {
        clients,
        history: enrichedHistory.filter((item) => clientOwnsItem(clientIds, item))
    };
};

export const getClientPortalSummary = async (user) => {
    const { clients, history } = await filterHistoryForUser(user);
    const paidServices = history.filter((item) => item.paymentStatus === 'PAID').length;
    const pendingFeedback = history.filter((item) => item.paymentStatus === 'PAID' && item.feedbackStatus !== 'COLLECTED').length;
    const complaints = await getClientPortalComplaints(user);
    const openComplaints = complaints.filter((item) => !['RESOLVED', 'CLOSED'].includes(String(item.status || '').toUpperCase())).length;

    return {
        clients,
        metrics: {
            services: history.length,
            paidServices,
            pendingFeedback,
            openComplaints
        },
        recentServices: history.slice(0, 5),
        recentComplaints: complaints.slice(0, 5)
    };
};

export const getClientPortalServiceHistory = async (user) => {
    const { history } = await filterHistoryForUser(user);
    return history;
};

export const getClientPortalMedicationSchedules = async (user) => {
    const { history } = await filterHistoryForUser(user);
    const allocationIds = new Set(history.map((item) => item.id).filter(Boolean));
    if (!allocationIds.size) return [];

    const issueRows = await prisma.$queryRaw`
        SELECT *
        FROM "StockIssueRequest"
        WHERE "tenantId" = ${user.tenantId}
          AND "unitId" = ${user.unitId}
          AND "isDeleted" = false
          AND "status" = 'APPROVED'
          AND "usageType" = 'PATIENT_MEDICATION'
        ORDER BY "approvedAt" DESC NULLS LAST, "createdAt" DESC
    `;

    const linkedIssues = (issueRows || []).filter((issue) => allocationIds.has(readNoteValue(issue.notes, 'Allocation')));
    const issueIds = linkedIssues.map((issue) => issue.id);
    if (!issueIds.length) return [];

    const issueById = new Map(linkedIssues.map((issue) => [issue.id, issue]));
    const schedules = await prisma.auditLog.findMany({
        where: {
            tenantId: user.tenantId,
            unitId: user.unitId,
            module: medicationScheduleModule,
            action: medicationScheduleAction,
            isDeleted: false
        },
        orderBy: { updatedAt: 'desc' },
        take: 300
    });

    return schedules
        .filter((schedule) => {
            const payload = schedule.payload && typeof schedule.payload === 'object' && !Array.isArray(schedule.payload) ? schedule.payload : {};
            return issueIds.includes(payload.medicineIssueId);
        })
        .map((schedule) => toPortalMedicationSchedule(schedule, issueById));
};

export const getClientPortalComplaints = async (user) => {
    const clients = await getPortalClients(user);
    const names = new Set(clients.map((client) => normalize(client.name)).filter(Boolean));
    if (!names.size) return [];

    const complaints = await getComplaints(user.tenantId, 'ALL');
    return complaints.filter((complaint) => {
        const metadata = complaint.metadata && typeof complaint.metadata === 'object' ? complaint.metadata : {};
        return names.has(normalize(metadata.clientName)) || names.has(normalize(complaint.title).replace(/^.* from /, ''));
    });
};

export const recordClientPortalFeedback = async (user, allocationId, data) => {
    const history = await getClientPortalServiceHistory(user);
    const item = history.find((record) => record.id === allocationId);
    if (!item) {
        const error = new Error('Service not found for this client login');
        error.status = 404;
        throw error;
    }

    return recordServiceFeedback(user.tenantId, 'ALL', user.id, allocationId, data);
};

export const createClientPortalComplaint = async (user, data) => {
    const clients = await getPortalClients(user);
    const client = clients[0];
    if (!client) {
        const error = new Error('No live client record is linked to this login email or mobile');
        error.status = 400;
        throw error;
    }

    return createComplaint(user.tenantId, {
        ...data,
        clientName: client.name,
        unitId: client.unitId,
        metadata: {
            ...(data.metadata || {}),
            source: 'CLIENT_PORTAL',
            clientId: client.id,
            clientRefNo: client.refNo
        }
    });
};

const getPortalPatients = async (user) => {
    const clients = await getPortalClients(user);
    const clientIds = clients.map((c) => c.id);
    if (!clientIds.length) return [];

    const enquiries = await prisma.enquiry.findMany({
        where: { clientId: { in: clientIds }, isDeleted: false, tenantId: user.tenantId },
        select: {
            admission: {
                select: {
                    patient: {
                        select: { id: true, name: true }
                    }
                }
            }
        }
    });

    const patientsMap = new Map();
    enquiries.forEach((enq) => {
        if (enq.admission?.patient) {
            patientsMap.set(enq.admission.patient.id, enq.admission.patient);
        }
    });
    return Array.from(patientsMap.values());
};

export const getClientPortalVitals = async (user, month) => {
    const patients = await getPortalPatients(user);
    if (!patients.length) return [];
    const patientIds = patients.map((p) => p.id);

    const rows = await prisma.$queryRaw`
        SELECT *
        FROM "CaregiverVitalChart"
        WHERE "tenantId" = ${user.tenantId}
          AND "isDeleted" = false
          AND "patientId" IN (${Prisma.join(patientIds)})
          ${month ? Prisma.sql`AND "month" = ${month}` : Prisma.empty}
        ORDER BY "month" DESC, "updatedAt" DESC
    `;

    return rows.map(row => ({
        ...row,
        entries: Array.isArray(row.entries) ? row.entries : [],
        signatures: row.signatures && typeof row.signatures === 'object' && !Array.isArray(row.signatures) ? row.signatures : {}
    }));
};

export const getClientPortalADL = async (user) => {
    const patients = await getPortalPatients(user);
    if (!patients.length) return [];
    const patientIds = patients.map((p) => p.id);
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const records = await prisma.auditLog.findMany({
        where: {
            tenantId: user.tenantId,
            module: 'HEALTHCARE_ADL',
            action: 'DAILY_LIVING',
            isDeleted: false
        },
        orderBy: { createdAt: 'desc' }
    });

    return records
        .filter(record => {
            const payload = record.payload && typeof record.payload === 'object' ? record.payload : {};
            return patientIds.includes(payload.patientId);
        })
        .map(record => {
            const payload = record.payload || {};
            return {
                id: record.id,
                patientId: payload.patientId,
                patient: patientMap.get(payload.patientId) || null,
                mobility: payload.mobility || '',
                hygiene: payload.hygiene || '',
                feeding: payload.feeding || '',
                notes: payload.notes || '',
                status: payload.status || 'RECORDED',
                recordedBy: payload.recordedBy || record.userId || '',
                createdAt: record.createdAt,
                updatedAt: record.updatedAt
            };
        });
};

export const getClientPortalNutrition = async (user) => {
    const patients = await getPortalPatients(user);
    if (!patients.length) return [];
    const patientIds = patients.map((p) => p.id);

    return prisma.nutrition.findMany({
        where: {
            patientId: { in: patientIds }
        },
        include: {
            patient: true
        },
        orderBy: { createdAt: 'desc' }
    });
};
