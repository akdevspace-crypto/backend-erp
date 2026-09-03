import { prisma } from '../../app/prisma.js';

export const getDailyMovementReport = async ({ tenantId, unitId, date, includeTenant }) => {
    // strict 24-hour UTC boundary check based on local date string YYYY-MM-DD
    let targetDate;
    try {
        targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            targetDate = new Date();
        }
    } catch {
        targetDate = new Date();
    }
    
    // Using UTC start and end to capture all movements for that local day
    // (Assuming the frontend passes YYYY-MM-DD which parses to UTC midnight)
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const scope = {
        tenantId,
        ...(includeTenant ? {} : { unitId })
    };

    // 1. VisitorPass
    const visitorPasses = await prisma.visitorPass.findMany({
        where: {
            ...scope,
            OR: [
                { createdAt: { gte: startOfDay, lte: endOfDay } },
                { checkInAt: { gte: startOfDay, lte: endOfDay } },
                { checkOutAt: { gte: startOfDay, lte: endOfDay } },
                { expectedAt: { gte: startOfDay, lte: endOfDay } }
            ]
        },
        include: {
            visitor: { select: { name: true, mobile: true } }
        }
    });

    // 2. Staff Movements
    const staffMovements = await prisma.staffDailyMovement.findMany({
        where: {
            ...scope,
            isDeleted: false,
            OR: [
                { entryAt: { gte: startOfDay, lte: endOfDay } },
                { finalExitAt: { gte: startOfDay, lte: endOfDay } }
            ]
        },
        include: {
            staff: { select: { firstName: true, lastName: true, empId: true } },
            trips: {
                where: { isDeleted: false },
                orderBy: { exitAt: 'asc' }
            }
        }
    });

    // 3. Vehicle Movements
    const vehicleMovements = await prisma.vehicleMovement.findMany({
        where: {
            ...scope,
            OR: [
                { entryAt: { gte: startOfDay, lte: endOfDay } },
                { exitAt: { gte: startOfDay, lte: endOfDay } }
            ]
        }
    });

    // 4. Resident Outing Requests
    const residentOutings = await prisma.residentOutingRequest.findMany({
        where: {
            ...scope,
            isDeleted: false,
            movements: {
                some: {
                    isDeleted: false,
                    OR: [
                        { exitAt: { gte: startOfDay, lte: endOfDay } },
                        { actualReturnAt: { gte: startOfDay, lte: endOfDay } }
                    ]
                }
            }
        },
        include: {
            patient: { select: { name: true } },
            movements: { where: { isDeleted: false } }
        }
    });

    // 5. Legacy AuditLog for compatibility (Pre-migration Staff/Vehicle/Visitor)
    const auditLogs = await prisma.auditLog.findMany({
        where: {
            ...scope,
            module: 'Security',
            isDeleted: false,
            createdAt: { gte: startOfDay, lte: endOfDay }
        },
        include: {
            user: { select: { firstName: true, email: true } }
        }
    });

    const reportEntries = [];

    // Map Visitors
    for (const vp of visitorPasses) {
        let status = 'Registered';
        if (vp.checkOutAt) status = 'Checked Out';
        else if (vp.checkInAt) status = 'Checked In';
        else if (vp.status === 'PENDING') status = 'Pending';
        else if (vp.expectedAt) status = 'Expected';

        reportEntries.push({
            id: vp.id,
            entryType: 'VISITOR',
            visitorName: vp.visitor?.name || vp.visitorName || 'Unknown',
            mobile: vp.visitor?.mobile,
            purpose: vp.purpose,
            checkInAt: vp.checkInAt,
            checkOutAt: vp.checkOutAt,
            status: status,
            recordedBy: vp.recordedBy || 'Front Desk',
            createdAt: vp.createdAt
        });
    }

    // Map Staff
    // To match SecurityReports expectation, we generate one row per physical entry->exit cycle.
    for (const sm of staffMovements) {
        // Staff Initial Entry -> Final Exit (or current status)
        reportEntries.push({
            id: sm.id,
            entryType: 'STAFF',
            staffName: [sm.staff?.firstName, sm.staff?.lastName].filter(Boolean).join(' ') || 'Unknown Staff',
            empId: sm.staff?.empId,
            mobile: null,
            purpose: 'Duty',
            checkInAt: sm.entryAt,
            checkOutAt: sm.finalExitAt,
            status: sm.status === 'COMPLETED' ? 'Checked Out' : 'Checked In',
            recordedBy: 'Security',
            createdAt: sm.createdAt
        });

        // Staff Temp Trips
        for (const trip of sm.trips) {
            reportEntries.push({
                id: trip.id,
                entryType: 'STAFF',
                staffName: `${[sm.staff?.firstName, sm.staff?.lastName].filter(Boolean).join(' ') || 'Unknown Staff'} (Temp Trip)`,
                empId: sm.staff?.empId,
                mobile: null,
                purpose: trip.reason || 'Temp Exit',
                checkInAt: trip.returnAt, // When they returned inside
                checkOutAt: trip.exitAt, // When they left
                status: trip.status === 'RETURNED' ? 'Returned' : 'Outside',
                recordedBy: 'Security',
                createdAt: trip.createdAt
            });
        }
    }

    // Map Vehicles
    for (const vm of vehicleMovements) {
        reportEntries.push({
            id: vm.id,
            entryType: 'VEHICLE',
            vehicleNo: vm.vehicleNo,
            driverMobile: vm.driverMobile,
            purpose: vm.purpose,
            checkInAt: vm.entryAt,
            checkOutAt: vm.exitAt,
            status: vm.status === 'COMPLETED' ? 'Checked Out' : 'Checked In',
            recordedBy: 'Security',
            createdAt: vm.createdAt
        });
    }

    // Map Residents
    for (const ro of residentOutings) {
        const m = ro.movements[0];
        reportEntries.push({
            id: ro.id,
            entryType: 'RESIDENT',
            visitorName: ro.patient?.name || 'Resident',
            mobile: null,
            purpose: 'Outing',
            checkInAt: m?.actualReturnAt, // Return back inside
            checkOutAt: m?.exitAt, // Exit outside
            status: m?.status === 'RETURNED' ? 'Returned' : 'Outside',
            recordedBy: 'Security',
            createdAt: ro.createdAt
        });
    }

    // Map Legacy AuditLogs to prevent data loss
    for (const log of auditLogs) {
        const payload = log.payload || {};
        const type = payload.entryType;
        
        // Skip duplicate modern events to avoid double-counting.
        if (type === 'VEHICLE' || type === 'STAFF' || type === 'VISITOR' || type === 'VISITOR_PASS' || type === 'EXPECTED_VISITOR') {
            const mappedType = type === 'VISITOR_PASS' || type === 'EXPECTED_VISITOR' ? 'VISITOR' : type;
            reportEntries.push({
                id: log.id,
                entryType: mappedType,
                visitorName: payload.visitorName || payload.name,
                vehicleNo: payload.vehicleNo,
                staffName: payload.staffName,
                empId: payload.empId,
                mobile: payload.mobile || payload.driverMobile,
                purpose: payload.purpose,
                checkInAt: payload.checkInAt || log.createdAt,
                checkOutAt: payload.checkOutAt,
                status: payload.status || log.action,
                recordedBy: log.user?.firstName || log.user?.email || 'Security',
                createdAt: log.createdAt
            });
        }
    }

    // Sort by chronological creation/entry time
    reportEntries.sort((a, b) => {
        const timeA = new Date(a.checkInAt || a.createdAt).getTime();
        const timeB = new Date(b.checkInAt || b.createdAt).getTime();
        return timeB - timeA; // Descending matches UI standard
    });

    return reportEntries;
};
