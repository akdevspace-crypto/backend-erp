import { prisma } from '../../app/prisma.js';

export const getSecurityDashboardSummary = async (tenantId, unitId, includeTenantWide) => {
    const baseWhere = {
        tenantId,
        ...(includeTenantWide ? {} : { unitId }),
    };

    const activeVisitorsCount = await prisma.visitorPass.count({
        where: {
            ...baseWhere,
            checkInAt: { not: null },
            checkOutAt: null,
        },
    });

    const activeStaffCount = await prisma.staffDailyMovement.count({
        where: {
            ...baseWhere,
            status: 'INSIDE',
            isDeleted: false,
        },
    });

    const activeVehiclesCount = await prisma.vehicleMovement.count({
        where: {
            ...baseWhere,
            status: 'INSIDE',
        },
    });

    return {
        activeVisitors: activeVisitorsCount,
        activeStaff: activeStaffCount,
        activeVehicles: activeVehiclesCount,
    };
};

export const getActionQueue = async ({ tenantId, unitId, includeTenantWide }) => {
    const scope = {
        tenantId,
        ...(includeTenantWide ? {} : { unitId })
    };

    // 1. Active Visitors (Currently Inside)
    const activeVisitors = await prisma.visitorPass.findMany({
        where: {
            ...scope,
            checkInAt: { not: null },
            checkOutAt: null
        },
        include: {
            visitor: { select: { name: true, mobile: true, photoUrl: true, category: true } }
        }
    });

    // 2. Active Resident Outings (Outside or Overdue)
    const activeResidents = await prisma.residentOutingRequest.findMany({
        where: {
            ...scope,
            isDeleted: false,
            movements: {
                some: {
                    isDeleted: false,
                    status: 'OUTSIDE' // Outside and potentially overdue
                }
            }
        },
        include: {
            patient: { select: { name: true, elderId: true } },
            movements: {
                where: { isDeleted: false, status: 'OUTSIDE' },
                include: {
                    exitRecordedByUser: { select: { firstName: true, email: true } }
                }
            }
        }
    });

    // 3. Active Staff (Currently Inside) & Temp Exits (Currently Outside)
    // To ensure a unified queue, we need StaffDailyMovements that are INSIDE.
    // And StaffGateTrips that are OUTSIDE (temporary exit).
    const activeStaffMovements = await prisma.staffDailyMovement.findMany({
        where: {
            ...scope,
            status: 'INSIDE',
            isDeleted: false
        },
        include: {
            staff: { select: { firstName: true, lastName: true, empId: true } },
            trips: {
                where: { isDeleted: false, status: 'OUTSIDE' },
                take: 1, // At most one active trip per movement
                orderBy: { exitAt: 'desc' }
            }
        }
    });

    // 4. Active Vehicles (Currently Inside)
    const activeVehicles = await prisma.vehicleMovement.findMany({
        where: {
            ...scope,
            status: 'INSIDE'
        }
    });

    const queueEntries = [];

    // Map Visitors
    for (const vp of activeVisitors) {
        queueEntries.push({
            id: vp.id,
            entryType: 'VISITOR',
            visitorName: vp.visitor?.name || vp.visitorName || 'Unknown',
            mobile: vp.visitor?.mobile,
            photoUrl: vp.visitor?.photoUrl,
            category: vp.visitor?.category,
            purpose: vp.purpose,
            visitingPerson: vp.hostName,
            department: vp.department,
            checkInAt: vp.checkInAt,
            status: 'Checked In',
            recordedBy: vp.recordedBy || 'Front Desk',
            createdAt: vp.createdAt
        });
    }

    // Map Residents
    const now = new Date();
    for (const reqData of activeResidents) {
        const m = reqData.movements[0];
        let status = 'Outside';
        let isOverdue = false;

        if (reqData.expectedReturnAt && new Date(reqData.expectedReturnAt) < now) {
            isOverdue = true;
            status = 'Overdue';
        }

        queueEntries.push({
            id: reqData.id,
            movementId: m?.id,
            entryType: 'RESIDENT',
            visitorName: reqData.patient?.name || 'Resident',
            mobile: reqData.patient?.elderId || '-',
            purpose: reqData.reason || 'Outing',
            visitingPerson: reqData.destination || '-',
            checkInAt: m?.exitAt, // Exit time serves as checkInAt for dashboard rendering
            status,
            isOverdue,
            recordedBy: m?.exitRecordedByUser?.firstName || m?.exitRecordedByUser?.email || 'Security',
            createdAt: reqData.createdAt
        });
    }

    // Map Staff
    for (const sm of activeStaffMovements) {
        const activeTrip = sm.trips[0];
        const staffName = [sm.staff?.firstName, sm.staff?.lastName].filter(Boolean).join(' ') || 'Unknown Staff';
        
        if (activeTrip) {
            // Temporary Exit State
            let status = 'Outside';
            let isOverdue = false;
            if (activeTrip.expectedReturnAt && new Date(activeTrip.expectedReturnAt) < now) {
                isOverdue = true;
                status = 'Overdue';
            }
            
            queueEntries.push({
                id: sm.id,
                movementId: activeTrip.id, // The trip ID for potential future use
                entryType: 'STAFF',
                staffName: `${staffName} (Temp Trip)`,
                empId: sm.staff?.empId,
                purpose: activeTrip.reason || 'Temp Exit',
                checkInAt: activeTrip.exitAt,
                status,
                isOverdue,
                recordedBy: 'Security',
                createdAt: activeTrip.createdAt
            });
        } else {
            // Inside State
            queueEntries.push({
                id: sm.id,
                entryType: 'STAFF',
                staffName,
                empId: sm.staff?.empId,
                purpose: 'Duty',
                checkInAt: sm.entryAt,
                status: 'Checked In',
                recordedBy: 'Security',
                createdAt: sm.createdAt
            });
        }
    }

    // Map Vehicles
    for (const vm of activeVehicles) {
        queueEntries.push({
            id: vm.id,
            entryType: 'VEHICLE',
            vehicleNo: vm.vehicleNo,
            driverMobile: vm.driverMobile,
            driverName: vm.driverName,
            purpose: vm.purpose,
            checkInAt: vm.entryAt,
            status: 'Checked In',
            recordedBy: 'Security',
            createdAt: vm.createdAt
        });
    }

    // Sort by checkInAt descending (most recent first)
    queueEntries.sort((a, b) => new Date(b.checkInAt || b.createdAt).getTime() - new Date(a.checkInAt || a.createdAt).getTime());

    return queueEntries;
};
