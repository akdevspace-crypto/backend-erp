import { prisma } from '../../app/prisma.js';

export const getMovementTimeline = async ({ tenantId, unitId, includeTenant, from, to, page, limit }) => {
    // Determine bounds
    let fromDate, toDate;
    
    if (from && to) {
        fromDate = new Date(from);
        toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
    } else {
        // Default to last 7 days
        toDate = new Date();
        fromDate = new Date();
        fromDate.setDate(toDate.getDate() - 7);
        fromDate.setHours(0, 0, 0, 0);
    }
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        throw new Error('Invalid date range');
    }

    const whereBase = {
        tenantId,
        ...(includeTenant ? {} : { unitId }),
    };

    // 1. Fetch StaffDailyMovement & Trips
    const staffMovements = await prisma.staffDailyMovement.findMany({
        where: {
            ...whereBase,
            isDeleted: false,
            OR: [
                { entryAt: { gte: fromDate, lte: toDate } },
                { finalExitAt: { gte: fromDate, lte: toDate } },
                { trips: { some: { exitAt: { gte: fromDate, lte: toDate }, isDeleted: false } } },
                { trips: { some: { returnAt: { gte: fromDate, lte: toDate }, isDeleted: false } } }
            ]
        },
        include: {
            staff: { select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true } },
            entryRecordedByUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
            finalExitRecordedByUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
            trips: {
                where: { isDeleted: false },
                include: {
                    exitRecordedByUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
                    returnRecordedByUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } }
                }
            }
        }
    });

    // 2. Fetch VehicleMovement
    const vehicleMovements = await prisma.vehicleMovement.findMany({
        where: {
            ...whereBase,
            OR: [
                { entryAt: { gte: fromDate, lte: toDate } },
                { exitAt: { gte: fromDate, lte: toDate } }
            ]
        },
        include: {
            entryUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
            exitUser: { select: { id: true, firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } }
        }
    });

    const events = [];

    const mapActor = (user) => {
        if (!user) return null;
        return {
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email,
            empId: user.staff?.empId,
            designation: user.staff?.designation
        };
    };

    // Expand Staff Events
    for (const mov of staffMovements) {
        const staffPayload = {
            id: mov.staff.id,
            empId: mov.staff.empId,
            name: `${mov.staff.firstName || ''} ${mov.staff.lastName || ''}`.trim(),
            designation: mov.staff.designation,
            department: mov.staff.department
        };

        // STAFF_ENTRY
        if (mov.entryAt >= fromDate && mov.entryAt <= toDate) {
            events.push({
                id: `${mov.id}-ENTRY`,
                sourceType: 'STAFF',
                eventType: 'STAFF_ENTRY',
                sourceId: mov.id,
                tripId: null,
                timestamp: mov.entryAt.toISOString(),
                staff: staffPayload,
                vehicle: null,
                tripDetails: null,
                actor: mapActor(mov.entryRecordedByUser)
            });
        }

        // TEMP_EXIT & STAFF_RETURN
        for (const trip of mov.trips) {
            if (trip.exitAt && trip.exitAt >= fromDate && trip.exitAt <= toDate) {
                events.push({
                    id: `${mov.id}-TRIP-${trip.id}-EXIT`,
                    sourceType: 'STAFF',
                    eventType: 'TEMP_EXIT',
                    sourceId: mov.id,
                    tripId: trip.id,
                    timestamp: trip.exitAt.toISOString(),
                    staff: staffPayload,
                    vehicle: null,
                    tripDetails: {
                        reason: trip.reason,
                        expectedReturnAt: trip.expectedReturnAt ? trip.expectedReturnAt.toISOString() : null,
                        materials: trip.materials
                    },
                    actor: mapActor(trip.exitRecordedByUser)
                });
            }

            if (trip.returnAt && trip.returnAt >= fromDate && trip.returnAt <= toDate) {
                events.push({
                    id: `${mov.id}-TRIP-${trip.id}-RETURN`,
                    sourceType: 'STAFF',
                    eventType: 'STAFF_RETURN',
                    sourceId: mov.id,
                    tripId: trip.id,
                    timestamp: trip.returnAt.toISOString(),
                    staff: staffPayload,
                    vehicle: null,
                    tripDetails: {
                        reason: trip.reason,
                        expectedReturnAt: trip.expectedReturnAt ? trip.expectedReturnAt.toISOString() : null,
                        materials: trip.materials
                    },
                    actor: mapActor(trip.returnRecordedByUser)
                });
            }
        }

        // STAFF_FINAL_EXIT
        if (mov.finalExitAt && mov.finalExitAt >= fromDate && mov.finalExitAt <= toDate) {
            events.push({
                id: `${mov.id}-FINAL-EXIT`,
                sourceType: 'STAFF',
                eventType: 'STAFF_FINAL_EXIT',
                sourceId: mov.id,
                tripId: null,
                timestamp: mov.finalExitAt.toISOString(),
                staff: staffPayload,
                vehicle: null,
                tripDetails: null,
                actor: mapActor(mov.finalExitRecordedByUser)
            });
        }
    }

    // Expand Vehicle Events
    for (const mov of vehicleMovements) {
        const vehiclePayload = {
            id: mov.id,
            vehicleNo: mov.vehicleNo,
            vehicleType: mov.vehicleType,
            driverName: mov.driverName,
            companyName: mov.companyName
        };

        // VEHICLE_ENTRY
        if (mov.entryAt >= fromDate && mov.entryAt <= toDate) {
            events.push({
                id: `${mov.id}-ENTRY`,
                sourceType: 'VEHICLE',
                eventType: 'VEHICLE_ENTRY',
                sourceId: mov.id,
                tripId: null,
                timestamp: mov.entryAt.toISOString(),
                staff: null,
                vehicle: vehiclePayload,
                tripDetails: {
                    reason: mov.purpose,
                    expectedReturnAt: null,
                    materials: mov.materialDetails ? JSON.stringify(mov.materialDetails) : null
                },
                actor: mapActor(mov.entryUser)
            });
        }

        // VEHICLE_EXIT
        if (mov.exitAt && mov.exitAt >= fromDate && mov.exitAt <= toDate) {
            events.push({
                id: `${mov.id}-EXIT`,
                sourceType: 'VEHICLE',
                eventType: 'VEHICLE_EXIT',
                sourceId: mov.id,
                tripId: null,
                timestamp: mov.exitAt.toISOString(),
                staff: null,
                vehicle: vehiclePayload,
                tripDetails: {
                    reason: mov.purpose,
                    expectedReturnAt: null,
                    materials: mov.materialDetails ? JSON.stringify(mov.materialDetails) : null
                },
                actor: mapActor(mov.exitUser)
            });
        }
    }

    // 3. Sort Chronologically (descending, newest first)
    events.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        // Deterministic secondary sort
        return b.id.localeCompare(a.id);
    });

    // 4. Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const total = events.length;
    
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedEvents = events.slice(startIndex, startIndex + limitNum);

    return {
        events: paginatedEvents,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            hasMore: startIndex + limitNum < total
        }
    };
};
