import { prisma } from '../../../app/prisma.js';

export const createCity = async (tenantId, unitId, data) => {
    const existingCity = await prisma.city.findFirst({
        where: {
            name: data.name,
            state: data.state,
            country: data.country,
            tenantId,
            unitId
        }
    });

    if (existingCity && !existingCity.isDeleted) {
        const error = new Error('City already exists for this state and country');
        error.status = 409;
        throw error;
    }

    if (existingCity?.isDeleted) {
        return prisma.city.update({
            where: { id: existingCity.id },
            data: {
                ...data,
                isDeleted: false,
                deletedAt: null
            }
        });
    }

    return prisma.city.create({
        data: {
            ...data,
            tenantId,
            unitId,
        }
    });
};

export const getCities = async (tenantId, unitId) => {
    return prisma.city.findMany({
        where: {
            tenantId,
            unitId,
            isDeleted: false
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getCityById = async (id, tenantId, unitId) => {
    const record = await prisma.city.findFirst({
        where: { id, tenantId, unitId, isDeleted: false }
    });
    if (!record) {
        const error = new Error('City not found');
        error.status = 404;
        throw error;
    }
    return record;
};

export const updateCity = async (id, tenantId, unitId, data) => {
    await getCityById(id, tenantId, unitId);
    return prisma.city.update({
        where: { id },
        data
    });
};

export const deleteCity = async (id, tenantId, unitId) => {
    await getCityById(id, tenantId, unitId);
    return prisma.city.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};
