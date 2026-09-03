import { prisma } from '../../app/prisma.js';

export const getVehicleMovements = async (tenantId, unitId, filters = {}) => {
    const { status, date, vehicleNo } = filters;
    const where = { tenantId };
    
    if (unitId) {
        where.unitId = unitId;
    }
    
    if (status) where.status = status;
    if (vehicleNo) where.vehicleNo = vehicleNo;
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        where.entryAt = { gte: startDate, lte: endDate };
    }

    return await prisma.vehicleMovement.findMany({
        where,
        include: {
            entryUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            exitUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            }
        },
        orderBy: { entryAt: 'desc' }
    });
};

export const getVehicleMovementById = async (tenantId, unitId, id) => {
    const where = { id, tenantId };
    if (unitId) {
        where.unitId = unitId;
    }
    
    return await prisma.vehicleMovement.findFirst({
        where,
        include: {
            entryUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            },
            exitUser: {
                select: { firstName: true, lastName: true, email: true, staff: { select: { empId: true, designation: true } } }
            }
        }
    });
};

export const createVehicleMovement = async (tenantId, unitId, userId, data) => {
    return await prisma.$transaction(async (tx) => {
        const normalizedVehicleNo = data.vehicleNo.trim().toUpperCase();

        const activeMovement = await tx.vehicleMovement.findFirst({
            where: {
                tenantId,
                vehicleNo: normalizedVehicleNo,
                status: 'INSIDE'
            }
        });

        if (activeMovement) {
            throw new Error('Vehicle is already inside the facility.');
        }

        const now = new Date();
        const movement = await tx.vehicleMovement.create({
            data: {
                tenantId,
                unitId,
                vehicleNo: normalizedVehicleNo,
                vehicleType: data.vehicleType,
                driverName: data.driverName,
                driverMobile: data.driverMobile,
                companyName: data.companyName,
                purpose: data.purpose,
                materialDetails: data.materialDetails,
                remarks: data.remarks,
                entryAt: now,
                entryUserId: userId,
                status: 'INSIDE'
            }
        });

        return movement;
    });
};

export const exitVehicleMovement = async (tenantId, unitId, userId, id) => {
    return await prisma.$transaction(async (tx) => {
        const where = { id, tenantId };
        if (unitId) {
            where.unitId = unitId;
        }

        const movement = await tx.vehicleMovement.findFirst({
            where
        });

        if (!movement) {
            throw new Error('Vehicle movement not found or unauthorized.');
        }

        if (movement.status === 'COMPLETED') {
            throw new Error('Vehicle movement is already completed.');
        }

        const now = new Date();
        const updated = await tx.vehicleMovement.update({
            where: { id },
            data: {
                exitAt: now,
                exitUserId: userId,
                status: 'COMPLETED'
            }
        });

        return updated;
    });
};
