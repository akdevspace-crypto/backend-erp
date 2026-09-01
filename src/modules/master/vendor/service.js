import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createVendor = async (data, unitId, tenantId) => {
    const existingVendor = await prisma.vendor.findFirst({
        where: {
            code: data.code,
            isDeleted: false
        }
    });

    if (existingVendor) {
        throw new AppError('Vendor ID already exists', 409);
    }

    return await prisma.vendor.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getVendors = async (unitId, tenantId) => {
    return await prisma.vendor.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getVendorById = async (id, unitId, tenantId) => {
    const record = await prisma.vendor.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('Vendor not found', 404);
    return record;
};

export const updateVendor = async (id, data, unitId, tenantId) => {
    await getVendorById(id, unitId, tenantId); // ensure exists

    if (data.code) {
        const existingVendor = await prisma.vendor.findFirst({
            where: {
                code: data.code,
                isDeleted: false,
                NOT: { id }
            }
        });

        if (existingVendor) {
            throw new AppError('Vendor ID already exists', 409);
        }
    }

    return await prisma.vendor.update({
        where: { id },
        data
    });
};

export const deleteVendor = async (id, unitId, tenantId) => {
    await getVendorById(id, unitId, tenantId); // ensure exists
    return await prisma.vendor.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
