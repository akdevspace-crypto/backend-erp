import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createDepartment = async (data, unitId, tenantId) => {
    return await prisma.department.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getDepartments = async (unitId, tenantId) => {
    return await prisma.department.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getDepartmentById = async (id, unitId, tenantId) => {
    const record = await prisma.department.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('Department not found', 404);
    return record;
};

export const updateDepartment = async (id, data, unitId, tenantId) => {
    await getDepartmentById(id, unitId, tenantId); // ensure exists
    return await prisma.department.update({
        where: { id },
        data
    });
};

export const deleteDepartment = async (id, unitId, tenantId) => {
    await getDepartmentById(id, unitId, tenantId); // ensure exists
    return await prisma.department.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
