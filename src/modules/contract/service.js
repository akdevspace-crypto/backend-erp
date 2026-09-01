import { prisma } from '../../app/prisma.js';
import { generateRefNumber } from '../../shared/utils/refGenerator.js';

export const getContractByAdmissionId = async (user, admissionId) => {
    const canReadAll = ['admin', 'super admin', 'superadmin', 'finance manager'].includes(String(user?.role || '').trim().toLowerCase());
    const hasFacilityWideAccess = canReadAll || (user.unitAccess && user.unitAccess.includes('*'));
    const accessibleUnits = hasFacilityWideAccess ? undefined : [user.unitId, ...(user.unitAccess || [])].filter(Boolean);
    return await prisma.serviceContract.findFirst({
        where: {
            tenantId: user.tenantId,
            ...(accessibleUnits ? { unitId: { in: accessibleUnits } } : {}),
            admissionId,
            isDeleted: false
        },
        include: {
            termsAcceptedBy: {
                select: { id: true, firstName: true, lastName: true }
            }
        }
    });
};

export const createDraftContract = async (user, data) => {
    const tenantId = user.tenantId;
    const unitId = user.unitId;
    // Verify admission exists and belongs to tenant
    const admission = await prisma.admission.findFirst({
        where: { id: data.admissionId, tenantId },
        include: {
            enquiry: {
                include: {
                    service: true
                }
            }
        }
    });

    if (!admission) {
        throw new Error('Admission not found or unauthorized');
    }

    // Check if contract already exists
    const existingContract = await prisma.serviceContract.findFirst({
        where: { admissionId: data.admissionId, isDeleted: false }
    });

    if (existingContract) {
        throw new Error('Service contract already exists for this admission');
    }

    // Generate contract number
    const contractNumber = await generateRefNumber('SC', tenantId, unitId, prisma);

    // Extract Req 1 data and pricing
    const serviceReqs = admission.enquiry?.serviceRequirements || {};
    
    // Normalize staffRequired safely to prevent Prisma Int vs String errors
    const normalizedStaffReq = serviceReqs.staffRequired != null 
        ? Number(serviceReqs.staffRequired) 
        : null;
    const finalStaffRequired = data.staffRequired ?? (!Number.isNaN(normalizedStaffReq) ? normalizedStaffReq : null);
    
    // Create DRAFT contract
    return await prisma.serviceContract.create({
        data: {
            contractNumber,
            admissionId: data.admissionId,
            tenantId,
            unitId,
            startDate: new Date(data.startDate),
            endDate: data.endDate ? new Date(data.endDate) : null,
            status: 'DRAFT',
            staffRequired: finalStaffRequired,
            shift: data.shift ?? serviceReqs.shift ?? null,
            frequency: data.frequency ?? serviceReqs.frequency ?? null,
            careRequirements: data.careRequirements ?? serviceReqs.careRequirements ?? null,
            specialInstructions: data.specialInstructions ?? serviceReqs.specialInstructions ?? null,
            servicePrice: data.servicePrice ?? admission.enquiry?.service?.price ?? null,
            billingCycle: data.billingCycle ?? null
        }
    });
};

export const updateDraftContract = async (user, contractId, data) => {
    const canReadAll = ['admin', 'super admin', 'superadmin', 'finance manager'].includes(String(user?.role || '').trim().toLowerCase());
    const hasFacilityWideAccess = canReadAll || (user.unitAccess && user.unitAccess.includes('*'));
    const accessibleUnits = hasFacilityWideAccess ? undefined : [user.unitId, ...(user.unitAccess || [])].filter(Boolean);
    const contract = await prisma.serviceContract.findFirst({
        where: {
            id: contractId,
            tenantId: user.tenantId,
            ...(accessibleUnits ? { unitId: { in: accessibleUnits } } : {}),
            isDeleted: false
        }
    });

    if (!contract) {
        throw new Error('Service contract not found');
    }

    if (contract.status !== 'DRAFT') {
        throw new Error('Only DRAFT contracts can be modified');
    }

    return await prisma.serviceContract.update({
        where: { id: contractId },
        data: {
            ...(data.startDate && { startDate: new Date(data.startDate) }),
            ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
            ...(data.staffRequired !== undefined && { staffRequired: data.staffRequired }),
            ...(data.shift !== undefined && { shift: data.shift }),
            ...(data.frequency !== undefined && { frequency: data.frequency }),
            ...(data.careRequirements !== undefined && { careRequirements: data.careRequirements }),
            ...(data.specialInstructions !== undefined && { specialInstructions: data.specialInstructions }),
            ...(data.servicePrice !== undefined && { servicePrice: data.servicePrice }),
            ...(data.billingCycle !== undefined && { billingCycle: data.billingCycle }),
            ...(data.termsSnapshot !== undefined && { termsSnapshot: data.termsSnapshot })
        }
    });
};

export const activateContract = async (user, contractId, userId) => {
    const canReadAll = ['admin', 'super admin', 'superadmin', 'finance manager'].includes(String(user?.role || '').trim().toLowerCase());
    const hasFacilityWideAccess = canReadAll || (user.unitAccess && user.unitAccess.includes('*'));
    const accessibleUnits = hasFacilityWideAccess ? undefined : [user.unitId, ...(user.unitAccess || [])].filter(Boolean);
    const contract = await prisma.serviceContract.findFirst({
        where: {
            id: contractId,
            tenantId: user.tenantId,
            ...(accessibleUnits ? { unitId: { in: accessibleUnits } } : {}),
            isDeleted: false
        }
    });

    if (!contract) {
        throw new Error('Service contract not found');
    }

    if (contract.status !== 'DRAFT') {
        throw new Error('Only DRAFT contracts can be activated');
    }

    return await prisma.serviceContract.update({
        where: { id: contractId },
        data: {
            status: 'ACTIVE',
            termsAcceptedAt: new Date(),
            termsAcceptedById: userId
        }
    });
};
