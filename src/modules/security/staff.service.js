import { prisma } from '../../app/prisma.js';

export const getStaffMovements = async (tenantId, unitId, filters = {}) => {
    const { status, date, staffId } = filters;
    const where = { tenantId, isDeleted: false };
    
    if (unitId) {
        where.unitId = unitId;
    }
    
    if (status) where.status = status;
    if (staffId) where.staffId = staffId;
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        where.entryAt = { gte: startDate, lte: endDate };
    }

    return await prisma.staffDailyMovement.findMany({
        where,
        include: {
            staff: {
                select: { id: true, empId: true, firstName: true, lastName: true, department: true, designation: true }
            },
            entryRecordedByUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            finalExitRecordedByUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            trips: {
                where: { isDeleted: false },
                include: {
                    exitRecordedByUser: { select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
                    returnRecordedByUser: { select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } }
                },
                orderBy: { exitAt: 'asc' }
            }
        },
        orderBy: { entryAt: 'desc' }
    });
};

export const getStaffMovementById = async (tenantId, unitId, id) => {
    return await prisma.staffDailyMovement.findFirst({
        where: { id, tenantId, unitId, isDeleted: false },
        include: {
            staff: {
                select: { id: true, empId: true, firstName: true, lastName: true, department: true, designation: true }
            },
            entryRecordedByUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            finalExitRecordedByUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            trips: {
                where: { isDeleted: false },
                include: {
                    exitRecordedByUser: { select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } },
                    returnRecordedByUser: { select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } } }
                },
                orderBy: { exitAt: 'asc' }
            }
        }
    });
};

export const recordStaffEntry = async (tenantId, unitId, userId, staffId) => {
    return await prisma.$transaction(async (tx) => {
        const staff = await tx.staff.findFirst({
            where: { id: staffId, tenantId, isDeleted: false }
        });
        if (!staff) throw new Error('Staff not found or does not belong to this tenant');

        const activeMovement = await tx.staffDailyMovement.findFirst({
            where: { staffId, status: 'INSIDE', isDeleted: false }
        });
        if (activeMovement) throw new Error('Staff already has an active daily movement');

        const now = new Date();
        const movement = await tx.staffDailyMovement.create({
            data: {
                staffId,
                tenantId,
                unitId: unitId,
                entryAt: now,
                entryRecordedByUserId: userId,
                status: 'INSIDE'
            }
        });

        // Sync with HR AttendanceLog
        const logDate = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z');
        const existingLog = await tx.attendanceLog.findFirst({
            where: {
                staffId,
                date: logDate
            }
        });

        if (existingLog) {
            if (!existingLog.checkIn) {
                await tx.attendanceLog.update({
                    where: { id: existingLog.id },
                    data: { checkIn: now }
                });
            }
        } else {
            await tx.attendanceLog.create({
                data: {
                    staffId,
                    date: logDate,
                    checkIn: now,
                    method: 'SECURITY_GATE',
                    metadata: { status: 'Present' },
                    tenantId,
                    unitId: staff.unitId || unitId
                }
            });
        }

        return movement;
    });
};

export const recordTempExit = async (tenantId, unitId, userId, movementId, data) => {
    return await prisma.$transaction(async (tx) => {
        const movement = await tx.staffDailyMovement.findFirst({
            where: { id: movementId, tenantId, unitId, isDeleted: false }
        });
        if (!movement) throw new Error('Movement not found or unauthorized');
        if (movement.status !== 'INSIDE') throw new Error('Movement is not active (INSIDE)');

        const activeTrip = await tx.staffGateTrip.findFirst({
            where: { movementId, status: 'OUTSIDE', isDeleted: false }
        });
        if (activeTrip) throw new Error('Staff is already outside on a temporary trip');

        const now = new Date();
        const trip = await tx.staffGateTrip.create({
            data: {
                movementId,
                tenantId,
                unitId,
                exitAt: now,
                reason: data.reason,
                expectedReturnAt: data.expectedReturnAt ? new Date(data.expectedReturnAt) : null,
                companionType: data.companionType || null,
                companionStaffId: data.companionStaffId || null,
                companionVisitorProfileId: data.companionVisitorProfileId || null,
                companionName: data.companionName || null,
                companionPhone: data.companionPhone || null,
                companionRelation: data.companionRelation || null,
                materials: data.materials || null,
                exitRecordedByUserId: userId,
                status: 'OUTSIDE'
            }
        });

        return trip;
    });
};

export const recordTempReturn = async (tenantId, unitId, userId, movementId, tripId) => {
    return await prisma.$transaction(async (tx) => {
        const movement = await tx.staffDailyMovement.findFirst({
            where: { id: movementId, tenantId, unitId, isDeleted: false }
        });
        if (!movement) throw new Error('Movement not found or unauthorized');
        if (movement.status !== 'INSIDE') throw new Error('Movement is not active (INSIDE)');

        const trip = await tx.staffGateTrip.findFirst({
            where: { id: tripId, movementId, tenantId, unitId, isDeleted: false }
        });
        if (!trip) throw new Error('Trip not found or unauthorized');
        if (trip.status !== 'OUTSIDE') throw new Error('Trip is already returned or invalid status');

        const now = new Date();
        const updatedTrip = await tx.staffGateTrip.update({
            where: { id: tripId },
            data: {
                returnAt: now,
                returnRecordedByUserId: userId,
                status: 'RETURNED'
            }
        });

        return updatedTrip;
    });
};

export const recordFinalExit = async (tenantId, unitId, userId, movementId) => {
    return await prisma.$transaction(async (tx) => {
        const movement = await tx.staffDailyMovement.findFirst({
            where: { id: movementId, tenantId, unitId, isDeleted: false }
        });
        if (!movement) throw new Error('Movement not found or unauthorized');
        if (movement.status !== 'INSIDE') throw new Error('Movement is already completed');

        const activeTrip = await tx.staffGateTrip.findFirst({
            where: { movementId, status: 'OUTSIDE', isDeleted: false }
        });
        if (activeTrip) throw new Error('Staff is currently outside on a temporary trip. Cannot record final exit.');

        const now = new Date();
        const updatedMovement = await tx.staffDailyMovement.update({
            where: { id: movementId },
            data: {
                finalExitAt: now,
                finalExitRecordedByUserId: userId,
                status: 'COMPLETED'
            }
        });

        // Sync with HR AttendanceLog
        const logDate = new Date(now.toISOString().split('T')[0] + 'T00:00:00.000Z');
        const existingLog = await tx.attendanceLog.findFirst({
            where: {
                staffId: movement.staffId,
                date: logDate
            }
        });

        if (existingLog) {
            if (!existingLog.checkOut) {
                await tx.attendanceLog.update({
                    where: { id: existingLog.id },
                    data: { checkOut: now }
                });
            }
        }

        return updatedMovement;
    });
};
