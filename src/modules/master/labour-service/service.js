import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createLabourService = async (data, unitId, tenantId) => {
    return await prisma.labourService.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getLabourServices = async (unitId, tenantId) => {
    return await prisma.labourService.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getLabourServiceById = async (id, unitId, tenantId) => {
    const record = await prisma.labourService.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('LabourService not found', 404);
    return record;
};

export const updateLabourService = async (id, data, unitId, tenantId) => {
    await getLabourServiceById(id, unitId, tenantId); // ensure exists
    return await prisma.labourService.update({
        where: { id },
        data
    });
};

export const deleteLabourService = async (id, unitId, tenantId) => {
    await getLabourServiceById(id, unitId, tenantId); // ensure exists
    return await prisma.labourService.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
