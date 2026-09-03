import { prisma } from '../../app/prisma.js';


export const getActiveGateQueue = async ({ tenantId, unitId, includeTenant, startOfDay }) => {
    const scope = { tenantId, unitId };

    // 1. Legacy Expected Visitors from AuditLog
    // Note: The UI filters on entryType === 'VISITOR' || 'VISITOR_PASS'
    // We only want 'VISITOR' (legacy expected visitors) from AuditLog.
    const auditLogEntries = await prisma.auditLog.findMany({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            module: 'Security',
            isDeleted: false
        },
        include: {
            user: { select: { firstName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const filteredAuditLogs = auditLogEntries.filter(entry => {
        const payload = entry.payload || {};
        return payload.entryType === 'VISITOR';
    });

    // 2. Active Visitor Passes
    const visitorPasses = await prisma.visitorPass.findMany({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            OR: [
                { checkInAt: { not: null }, checkOutAt: null }, // Currently inside
                { createdAt: { gte: startOfDay } }, // Registered today
                { expectedAt: { gte: startOfDay } }, // Expected today
                { checkOutAt: { gte: startOfDay } } // Checked out today
            ]
        },
        include: {
            visitor: true,
            approvedByUser: {
                select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    staff: {
                        select: { empId: true, designation: true }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // 3. Resident Outings
    const residentRequests = await prisma.residentOutingRequest.findMany({
        where: {
            tenantId,
            ...(includeTenant ? {} : { unitId }),
            isDeleted: false,
            OR: [
                { status: 'APPROVED' },
                { movements: { some: { status: 'OUTSIDE', isDeleted: false } } },
                { movements: { some: { actualReturnAt: { gte: startOfDay }, isDeleted: false } } }
            ]
        },
        include: {
            patient: { select: { name: true, elderId: true } },
            requestedByUser: { select: { firstName: true, email: true } },
            movements: {
                where: { isDeleted: false },
                include: { 
                    exitRecordedByUser: { select: { firstName: true, email: true } },
                    returnRecordedByUser: { select: { firstName: true, email: true } }
                },
                orderBy: { createdAt: 'desc' }
            }
        },
        orderBy: { expectedExitAt: 'desc' }
    });

    // Map the results identically to legacy to ensure smooth frontend migration in Phase 3
    const mappedVisitorPasses = visitorPasses.map(vp => {
        let status = 'Expected';
        if (vp.checkOutAt) status = 'Checked Out';
        else if (vp.checkInAt) status = 'Checked In';
        else if (vp.status === 'PENDING') status = 'Pending';
        else status = 'Registered';

        let approvedBy;
        if (vp.approvedByUser) {
            const approver = vp.approvedByUser;
            approvedBy = {
                name: [approver.firstName, approver.lastName].filter(Boolean).join(' ').trim() || approver.email || 'Unknown',
                empId: approver.staff?.empId,
                designation: approver.staff?.designation
            };
        }

        return {
            id: vp.id,
            createdAt: vp.createdAt,
            updatedAt: vp.updatedAt,
            tenantId: vp.tenantId,
            unitId: vp.unitId,
            recordedBy: vp.recordedBy || 'Front Desk',
            entryType: 'VISITOR_PASS',
            visitorName: vp.visitor?.name,
            mobile: vp.visitor?.mobile,
            photoUrl: vp.visitor?.photoUrl,
            category: vp.visitor?.category,
            purpose: vp.purpose,
            visitingPerson: vp.hostName,
            department: vp.department,
            vehicleNo: vp.vehicleNo,
            remarks: vp.materialDetails || '',
            expectedAt: vp.expectedAt,
            checkInAt: vp.checkInAt,
            checkOutAt: vp.checkOutAt,
            status: status,
            ...(approvedBy && { approvedBy })
        };
    });

    const mappedResidentMovements = residentRequests.map(reqData => {
        const m = reqData.movements?.[0];
        
        let status = reqData.status === 'APPROVED' ? 'Approved' : 'Unknown';
        if (m) {
            status = m.status === 'OUTSIDE' ? 'Outside' : (m.status === 'RETURNED' ? 'Returned' : status);
        }
        
        const now = new Date();
        let isOverdue = false;
        if (m?.status === 'OUTSIDE' && reqData.expectedReturnAt && new Date(reqData.expectedReturnAt) < now) {
            isOverdue = true;
            status = 'Overdue';
        }

        return {
            id: reqData.id,
            movementId: m?.id,
            createdAt: reqData.createdAt,
            updatedAt: reqData.updatedAt,
            tenantId: reqData.tenantId,
            unitId: reqData.unitId,
            recordedBy: m?.exitRecordedByUser?.firstName || m?.exitRecordedByUser?.email || reqData.requestedByUser?.firstName || reqData.requestedByUser?.email || 'Security',
            entryType: 'RESIDENT',
            visitorName: reqData.patient ? `${reqData.patient.name}`.trim() : 'Unknown Patient',
            mobile: reqData.patient?.elderId || '-',
            photoUrl: null,
            category: 'RESIDENT',
            purpose: reqData.reason || 'Resident Outing',
            visitingPerson: reqData.destination || '-',
            department: '-',
            vehicleNo: '-',
            remarks: reqData.materials ? JSON.stringify(reqData.materials) : '',
            expectedAt: reqData.expectedExitAt,
            expectedReturnAt: reqData.expectedReturnAt,
            checkInAt: m?.exitAt,
            checkOutAt: m?.actualReturnAt,
            exitRecordedBy: m?.exitRecordedByUser?.firstName || m?.exitRecordedByUser?.email || reqData.requestedByUser?.firstName || reqData.requestedByUser?.email || '-',
            returnRecordedBy: m?.returnRecordedByUser?.firstName || m?.returnRecordedByUser?.email || '-',
            status: status,
            isOverdue
        };
    });

    const normalizeAuditLogEntry = (entry) => {
        return {
            id: entry.id,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            tenantId: entry.tenantId,
            unitId: entry.unitId,
            recordedBy: entry.user?.firstName || entry.user?.email || entry.payload?.recordedBy || '-',
            ...(entry.payload || {})
        };
    };

    const combined = [...filteredAuditLogs.map(normalizeAuditLogEntry), ...mappedVisitorPasses, ...mappedResidentMovements];
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return combined;
};
