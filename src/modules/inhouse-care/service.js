import { prisma } from '../../app/prisma.js';

export const createVitalSign = async (tenantId, unitId, userId, data) => {
    return prisma.vitalSign.create({
        data: {
            ...data,
            recordedById: userId,
            tenantId,
            unitId,
        }
    });
};

export const getVitalsByPatient = async (tenantId, unitId, patientId) => {
    return prisma.vitalSign.findMany({
        where: { tenantId, unitId, patientId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};
