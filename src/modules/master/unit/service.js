import { prisma } from '../../../app/prisma.js';

const isSchemaUnavailableError = (error) =>
    error?.code === 'P2021' ||
    error?.code === 'P2022' ||
    error?.code === 'P2024' ||
    error?.name === 'PrismaClientValidationError';

const buildLocationSystemNotReadyError = (message = 'Location system is not yet activated on the server. Run the Prisma migration and regenerate Prisma Client.') => {
    const error = new Error(message);
    error.status = 503;
    error.code = 'LOCATION_SYSTEM_NOT_READY';
    return error;
};

const ensureLocationModelAvailable = () => {
    if (!prisma?.location) {
        throw buildLocationSystemNotReadyError();
    }
};

const normalizePrismaSchemaError = (error) => {
    if (isSchemaUnavailableError(error)) {
        throw buildLocationSystemNotReadyError();
    }

    throw error;
};

const ensureLocationExists = async (locationId) => {
    ensureLocationModelAvailable();

    try {
        const location = await prisma.location.findUnique({
            where: { id: locationId }
        });

        if (!location) {
            const error = new Error('Selected location does not exist');
            error.status = 400;
            throw error;
        }
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};

const ensureUnitExists = async (id, tenantId) => {
    try {
        const unit = await prisma.unit.findFirst({
            where: {
                id,
                tenantId,
                isDeleted: false
            }
        });

        if (!unit) {
            const error = new Error('Unit not found');
            error.status = 404;
            throw error;
        }

        return unit;
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};

export const createUnit = async (tenantId, data) => {
    await ensureLocationExists(data.locationId);

    try {
        return await prisma.unit.create({
            data: {
                ...data,
                tenantId
            },
            include: {
                location: true
            }
        });
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};

export const getUnits = async (tenantId) => {
    try {
        return await prisma.unit.findMany({
            where: {
                tenantId,
                isDeleted: false
            },
            include: {
                location: true
            },
            orderBy: { createdAt: 'desc' }
        });
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};

export const updateUnit = async (id, tenantId, data) => {
    await ensureUnitExists(id, tenantId);
    await ensureLocationExists(data.locationId);

    try {
        return await prisma.unit.update({
            where: { id },
            data,
            include: {
                location: true
            }
        });
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};

export const deleteUnit = async (id, tenantId) => {
    await ensureUnitExists(id, tenantId);

    try {
        return await prisma.unit.update({
            where: { id },
            data: { isDeleted: true, deletedAt: new Date() }
        });
    } catch (error) {
        normalizePrismaSchemaError(error);
    }
};
