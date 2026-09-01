import { prisma } from '../../app/prisma.js';

export const createVitalSign = async (tenantId, unitId, userId, data) => {
    return prisma.vitalSign.create({
        data: {
            ...data,
            recordedById: userId,
            tenantId,
            unitId
        }
    });
};

export const getVitalSigns = async (scope, patientId) => {
    const whereClause = { ...scope, isDeleted: false };
    if (patientId) whereClause.patientId = patientId;

    return prisma.vitalSign.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' }
    });
};

export const updateVitalSign = async (tenantId, unitId, id, data) => {
    const existing = await prisma.vitalSign.findFirst({
        where: { id, tenantId, unitId, isDeleted: false },
        select: { id: true }
    });
    if (!existing) {
        const error = new Error('Vital sign not found');
        error.status = 404;
        throw error;
    }
    return prisma.vitalSign.update({
        where: { id },
        data
    });
};
