import { prisma } from '../../app/prisma.js';
import { generateRefNumber } from '../../shared/utils/refGenerator.js';

const buildAllocationDutyDescription = (allocation, notes) => [
    `Allocation:${allocation.id}`,
    `Reference: ${allocation.refNo}`,
    `Client: ${allocation.enquiry?.client?.name || 'Client pending'}`,
    `Patient: ${allocation.metadata?.patientName || allocation.enquiry?.client?.name || 'Patient pending'}`,
    `Care Type: ${allocation.type}`,
    notes ? `Notes: ${notes}` : null
].filter(Boolean).join('\n');

const syncAllocationDutyTask = async (allocation) => {
    if (!allocation?.staffId || allocation.status !== 'ALLOCATED') return;

    const staff = allocation.staff || await prisma.staff.findFirst({
        where: {
            id: allocation.staffId,
            tenantId: allocation.tenantId,
            unitId: allocation.unitId,
            isDeleted: false
        },
        select: {
            id: true,
            userId: true,
            firstName: true,
            lastName: true,
            empId: true
        }
    });

    if (!staff) return;

    const serviceName = allocation.enquiry?.service?.name || 'Care Duty';
    const clientName = allocation.enquiry?.client?.name || 'Client';
    const description = buildAllocationDutyDescription(allocation, allocation.metadata?.notes);
    const existingTask = await prisma.task.findFirst({
        where: {
            tenantId: allocation.tenantId,
            unitId: allocation.unitId,
            isDeleted: false,
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
            description: { contains: `Allocation:${allocation.id}` }
        },
        select: { id: true }
    });

    const taskData = {
        title: `${serviceName} duty - ${clientName}`,
        description,
        type: allocation.endDate ? 'SCHEDULED' : 'DAILY',
        priority: allocation.metadata?.priority || 'MEDIUM',
        assigneeId: staff.userId || null,
        assignedStaffId: staff.id,
        enquiryId: allocation.enquiryId,
        dueDate: allocation.startDate || new Date(),
        tenantId: allocation.tenantId,
        unitId: allocation.unitId,
        status: 'ASSIGNED'
    };

    if (existingTask) {
        await prisma.task.update({
            where: { id: existingTask.id },
            data: taskData
        });
        return;
    }

    await prisma.task.create({
        data: {
            refNo: await generateRefNumber('TSK', allocation.tenantId, allocation.unitId, prisma),
            ...taskData
        }
    });
};

export const createAllocation = async (tenantId, unitId, data) => {
    const enquiry = await prisma.enquiry.findFirst({
        where: {
            id: data.enquiryId,
            tenantId,
            isDeleted: false
        },
        select: { id: true, unitId: true }
    });

    if (!enquiry) {
        const error = new Error('Admission enquiry not found or access denied');
        error.status = 404;
        throw error;
    }

    const sourceUnitId = enquiry.unitId || unitId;
    const targetUnitId = data.targetUnitId || sourceUnitId;

    if (targetUnitId !== sourceUnitId) {
        const targetUnit = await prisma.unit.findFirst({
            where: {
                id: targetUnitId,
                tenantId,
                status: true,
                isDeleted: false
            },
            select: { id: true }
        });

        if (!targetUnit) {
            const error = new Error('Target care unit not found or access denied');
            error.status = 404;
            throw error;
        }
    }

    if (data.staffId) {
        const staff = await prisma.staff.findFirst({
            where: {
                id: data.staffId,
                tenantId,
                unitId: targetUnitId,
                isDeleted: false
            },
            select: { id: true }
        });

        if (!staff) {
            const error = new Error('Selected staff not found in this unit');
            error.status = 404;
            throw error;
        }
    }

    const allocationRef = await generateRefNumber('ALC', tenantId, targetUnitId, prisma);
    const metadata = {
        ...(data.metadata || {}),
        handoffSource: data.metadata?.handoffSource || 'ADMISSION_TRACKING',
        sourceUnitId,
        targetUnitId
    };

    const allocation = await prisma.allocation.upsert({
        where: {
            enquiryId: data.enquiryId
        },
        update: {
            staffId: data.staffId,
            type: data.type || 'HOME_CARE',
            status: data.status || 'ALLOCATED',
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate) : null,
            metadata,
            unitId: targetUnitId,
            isDeleted: false,
            deletedAt: null
        },
        create: {
            refNo: allocationRef,
            enquiryId: data.enquiryId,
            staffId: data.staffId,
            type: data.type || 'HOME_CARE',
            status: data.status || 'ALLOCATED',
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate) : null,
            metadata,
            tenantId,
            unitId: targetUnitId,
        }
    }).then((allocation) => prisma.allocation.findUnique({
        where: { id: allocation.id },
        include: {
            enquiry: {
                select: {
                    id: true,
                    refNo: true,
                    mode: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                            category: true
                        }
                    }
                }
            },
            staff: {
                select: {
                    id: true,
                    userId: true,
                    firstName: true,
                    lastName: true,
                    empId: true
                }
            }
        }
    }));

    await syncAllocationDutyTask(allocation);

    return allocation;
};

export const getAllocationsByType = async (tenantId, unitId, type) => {
    const isDemoReference = (value) => {
        const normalized = String(value || '').toUpperCase();
        return normalized.startsWith('DEMO-') || normalized.startsWith('SEED-');
    };

    const allocations = await prisma.allocation.findMany({
        where: {
            tenantId,
            ...(unitId && unitId !== 'ALL' ? { unitId } : {}),
            type,
            isDeleted: false
        },
        include: {
            enquiry: {
                select: {
                    id: true,
                    refNo: true,
                    rawMessage: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    admission: {
                        select: {
                            id: true,
                            patient: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            },
            staff: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    empId: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return allocations.filter((allocation) => (
        !allocation.metadata?.demo &&
        !isDemoReference(allocation.refNo) &&
        !isDemoReference(allocation.enquiry?.refNo) &&
        !isDemoReference(allocation.staff?.empId)
    ));
};

export const updateAllocation = async (tenantId, unitId, id, data) => {
    const existing = await prisma.allocation.findFirst({
        where: { id, tenantId, isDeleted: false },
        select: { id: true, metadata: true, unitId: true }
    });
    if (!existing) {
        const error = new Error('Allocation not found');
        error.status = 404;
        throw error;
    }

    let assignmentUnitId = existing.unitId || unitId;

    if (data.staffId) {
        const staff = await prisma.staff.findFirst({
            where: {
                id: data.staffId,
                tenantId,
                isDeleted: false
            },
            select: { id: true, unitId: true }
        });

        if (!staff) {
            const error = new Error('Selected staff not found');
            error.status = 404;
            throw error;
        }

        assignmentUnitId = staff.unitId || assignmentUnitId;
    }

    const updateData = {
        ...data,
        unitId: assignmentUnitId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : data.endDate === null ? null : undefined,
        metadata: data.metadata
            ? {
                ...(existing.metadata || {}),
                ...data.metadata
            }
            : undefined
    };

    const allocation = await prisma.allocation.update({
        where: { id },
        data: updateData,
        include: {
            enquiry: {
                select: {
                    id: true,
                    refNo: true,
                    rawMessage: true,
                    mode: true,
                    client: {
                        select: {
                            id: true,
                            name: true,
                            mobile: true
                        }
                    },
                    service: {
                        select: {
                            id: true,
                            name: true,
                            category: true
                        }
                    }
                }
            },
            staff: {
                select: {
                    id: true,
                    userId: true,
                    firstName: true,
                    lastName: true,
                    empId: true
                }
            }
        }
    });

    await syncAllocationDutyTask(allocation);

    return allocation;
};
