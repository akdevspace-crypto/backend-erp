import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createClientService = async (data, unitId, tenantId) => {
    return await prisma.clientService.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getClientServices = async (unitId, tenantId) => {
    return await prisma.clientService.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getClientServiceById = async (id, unitId, tenantId) => {
    const record = await prisma.clientService.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('ClientService not found', 404);
    return record;
};

export const updateClientService = async (id, data, unitId, tenantId) => {
    await getClientServiceById(id, unitId, tenantId); // ensure exists
    return await prisma.clientService.update({
        where: { id },
        data
    });
};

export const deleteClientService = async (id, unitId, tenantId) => {
    await getClientServiceById(id, unitId, tenantId); // ensure exists
    return await prisma.clientService.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
