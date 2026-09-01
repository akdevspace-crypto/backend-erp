import { prisma } from '../../app/prisma.js';

export const getClosureByAdmissionId = async (admissionId) => {
    return await prisma.serviceClosure.findUnique({
        where: { admissionId },
        include: {
            admission: true,
            medicalClearedBy: { select: { id: true, firstName: true, lastName: true } },
            financeClearedBy: { select: { id: true, firstName: true, lastName: true } },
            assetClearedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });
};

export const createClosure = async (data) => {
    return await prisma.serviceClosure.create({
        data,
        include: {
            admission: true,
            medicalClearedBy: { select: { id: true, firstName: true, lastName: true } },
            financeClearedBy: { select: { id: true, firstName: true, lastName: true } },
            assetClearedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });
};

export const updateClosure = async (id, data) => {
    return await prisma.serviceClosure.update({
        where: { id },
        data,
        include: {
            admission: true,
            medicalClearedBy: { select: { id: true, firstName: true, lastName: true } },
            financeClearedBy: { select: { id: true, firstName: true, lastName: true } },
            assetClearedBy: { select: { id: true, firstName: true, lastName: true } }
        }
    });
};

export const getClosureById = async (id) => {
    return await prisma.serviceClosure.findUnique({
        where: { id },
        include: { admission: true }
    });
};

export const findClosures = async (filters, ctx) => {
    return await prisma.serviceClosure.findMany({
        where: {
            tenantId: ctx.tenantId,
            unitId: ctx.unitId,
            ...filters
        },
        include: {
            admission: {
                include: { patient: true }
            },
            medicalClearedBy: { select: { id: true, firstName: true, lastName: true } },
            financeClearedBy: { select: { id: true, firstName: true, lastName: true } },
            assetClearedBy: { select: { id: true, firstName: true, lastName: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });
};
