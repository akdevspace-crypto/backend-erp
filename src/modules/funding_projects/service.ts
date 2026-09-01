import { prisma } from '../../app/prisma.js';

export const getFundingCategories = async (tenantId: string) => {
    return await prisma.fundingCategory.findMany({ where: { tenantId, isDeleted: false } });
}

export const createFundingCategory = async (tenantId: string, unitId: string, data: any) => {
    return await prisma.fundingCategory.create({ data: { ...data, tenantId, unitId } });
}

export const getProjectClassifications = async (tenantId: string) => {
    return await prisma.projectClassification.findMany({ where: { tenantId, isDeleted: false } });
}

export const createProjectClassification = async (tenantId: string, unitId: string, data: any) => {
    return await prisma.projectClassification.create({ data: { ...data, tenantId, unitId } });
}

export const getProjects = async (tenantId: string) => {
    return await prisma.project.findMany({ 
        where: { tenantId, isDeleted: false },
        include: { category: true, classification: true }
    });
}

export const createProject = async (tenantId: string, unitId: string, data: any) => {
    return await prisma.project.create({ data: { ...data, tenantId, unitId } });
}

export const getFundingAllocations = async (tenantId: string, projectId?: string) => {
    const where: any = { tenantId, isDeleted: false };
    if (projectId) where.projectId = projectId;
    return await prisma.fundingAllocation.findMany({ where, include: { project: true } });
}

export const createFundingAllocation = async (tenantId: string, data: any) => {
    return await prisma.fundingAllocation.create({ data: { ...data, tenantId } });
}

export const getProjectExpenditures = async (tenantId: string, projectId?: string) => {
    const where: any = { tenantId, isDeleted: false };
    if (projectId) where.projectId = projectId;
    return await prisma.projectExpenditure.findMany({ where, include: { project: true } });
}

export const createProjectExpenditure = async (tenantId: string, data: any) => {
    return await prisma.projectExpenditure.create({ data: { ...data, tenantId } });
}

export const approveExpenditure = async (tenantId: string, expenditureId: string, status: string, userId: string) => {
    return await prisma.projectExpenditure.update({
        where: { id: expenditureId, tenantId },
        data: { approvalStatus: status, approvedById: userId }
    });
}
