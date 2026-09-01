import { prisma } from '../../app/prisma.js';

export const createWelcomeCall = async (tenantId, unitId, data) => {
    return prisma.welcomeCall.create({
        data: {
            ...data,
            tenantId,
            unitId
        }
    });
};

export const getWelcomeCalls = async (tenantId, unitId) => {
    return prisma.welcomeCall.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const updateWelcomeCall = async (tenantId, unitId, id, data) => {
    const existing = await prisma.welcomeCall.findFirst({
        where: { id, tenantId, unitId, isDeleted: false },
        select: { id: true }
    });
    if (!existing) {
        const error = new Error('Welcome call not found');
        error.status = 404;
        throw error;
    }
    return prisma.welcomeCall.update({
        where: { id },
        data
    });
};
