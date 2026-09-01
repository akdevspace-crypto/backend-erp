import { prisma } from '../../../app/prisma.js';
import { AppError } from '../../../shared/utils/response.js';

export const createPaymentCategory = async (data, unitId, tenantId) => {
    return await prisma.paymentCategory.create({
        data: {
            ...data,
            unitId,
            tenantId
        }
    });
};

export const getPaymentCategorys = async (unitId, tenantId) => {
    return await prisma.paymentCategory.findMany({
        where: { unitId, tenantId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const getPaymentCategoryById = async (id, unitId, tenantId) => {
    const record = await prisma.paymentCategory.findFirst({
        where: { id, unitId, tenantId, isDeleted: false }
    });
    if (!record) throw new AppError('PaymentCategory not found', 404);
    return record;
};

export const updatePaymentCategory = async (id, data, unitId, tenantId) => {
    await getPaymentCategoryById(id, unitId, tenantId); // ensure exists
    return await prisma.paymentCategory.update({
        where: { id },
        data
    });
};

export const deletePaymentCategory = async (id, unitId, tenantId) => {
    await getPaymentCategoryById(id, unitId, tenantId); // ensure exists
    return await prisma.paymentCategory.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
