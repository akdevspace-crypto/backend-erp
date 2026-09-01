import { prisma } from '../../app/prisma.js';

const isMissingWelcomeCallStorage = (error) => {
    return ['P2021', 'P2022', 'P2010'].includes(error?.code);
};

export const createWelcomeCall = async (tenantId, unitId, data) => {
    return prisma.welcomeCall.create({
        data: {
            ...data,
            tenantId,
            unitId,
        }
    });
};

export const getWelcomeCalls = async (tenantId, unitId) => {
    try {
        return await prisma.welcomeCall.findMany({
            where: { tenantId, unitId, isDeleted: false },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        if (isMissingWelcomeCallStorage(error)) {
            console.warn('WelcomeCall storage is not ready; returning an empty list.');
            return [];
        }
        throw error;
    }
};

export const updateWelcomeCall = async (id, data) => {
    return prisma.welcomeCall.update({
        where: { id },
        data
    });
};
