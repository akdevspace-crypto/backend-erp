const fs = require('fs');

const filePath = 'd:/ERP/Backend/src/modules/medical/service.js';
let code = fs.readFileSync(filePath, 'utf8');

const mapFunc = `const mapAssignmentResponse = (assignment) => {
    if (!assignment) return assignment;
    const { Staff, Patient, ...rest } = assignment;
    return {
        ...rest,
        ...(Staff !== undefined && { staff: Staff }),
        ...(Patient !== undefined && { patient: Patient })
    };
};

const assignmentInclude = {`;

code = code.replace('const assignmentInclude = {', mapFunc);

code = code.replace(`    staff: {
        select: {
            id: true,
            empId: true,`, `    Staff: {
        select: {
            id: true,
            empId: true,`);

code = code.replace(`    patient: {
        select: {
            id: true,
            name: true
        }
    }`, `    Patient: {
        select: {
            id: true,
            name: true
        }
    }`);

code = code.replace(`            {
                patient: {
                    is: {
                        name: { contains: search, mode: 'insensitive' }
                    }
                }
            }`, `            {
                Patient: {
                    is: {
                        name: { contains: search, mode: 'insensitive' }
                    }
                }
            }`);

code = code.replace(`    return prisma.medicalAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [
            { status: 'asc' },
            { startAt: 'asc' },
            { createdAt: 'desc' }
        ]
    });
};`, `    const assignments = await prisma.medicalAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: [
            { status: 'asc' },
            { startAt: 'asc' },
            { createdAt: 'desc' }
        ]
    });
    return assignments.map(mapAssignmentResponse);
};`);

code = code.replace(`    if (!assignment) {
        throw buildHttpError('Medical assignment not found', 404);
    }

    return assignment;
};`, `    if (!assignment) {
        throw buildHttpError('Medical assignment not found', 404);
    }

    return mapAssignmentResponse(assignment);
};`);

code = code.replace(`        return tx.medicalAssignment.findUnique({
            where: { id: assignment.id },
            include: assignmentInclude
        });
    });
};

export const updateMedicalAssignment = async (tenantId, unitId, id, data) => {`, `        const createdAssignment = await tx.medicalAssignment.findUnique({
            where: { id: assignment.id },
            include: assignmentInclude
        });
        return mapAssignmentResponse(createdAssignment);
    });
};

export const updateMedicalAssignment = async (tenantId, unitId, id, data) => {`);

code = code.replace(`        await generateOperationalTasksForAssignment(tx, assignment, staffName);

        return tx.medicalAssignment.findUnique({
            where: { id: assignment.id },
            include: assignmentInclude
        });
    });
};

export const updateMedicalAssignmentStatus = async (tenantId, unitId, id, data) => {`, `        await generateOperationalTasksForAssignment(tx, assignment, staffName);

        const updatedAssignment = await tx.medicalAssignment.findUnique({
            where: { id: assignment.id },
            include: assignmentInclude
        });
        return mapAssignmentResponse(updatedAssignment);
    });
};

export const updateMedicalAssignmentStatus = async (tenantId, unitId, id, data) => {`);

code = code.replace(`        await recalculateStaffCurrentWorkload(tx, existing.staffId);
        return assignment;
    });
};

export const getDoctorVisits = async (tenantId, unitId, filters = {}) => {`, `        await recalculateStaffCurrentWorkload(tx, existing.staffId);
        return mapAssignmentResponse(assignment);
    });
};

export const getDoctorVisits = async (tenantId, unitId, filters = {}) => {`);

code = code.replace(`    const assignments = await prisma.medicalAssignment.findMany({
        where: {
            staffId: staff.id,
            tenantId,
            unitId,
            isDeleted: false,
            startAt: { lte: todayEnd },
            OR: [
                { endAt: null },
                { endAt: { gte: todayStart } }
            ]
        },
        include: assignmentInclude,
        orderBy: { startAt: 'asc' }
    });

    const assignmentIds = assignments.map(a => a.id);`, `    const rawAssignments = await prisma.medicalAssignment.findMany({
        where: {
            staffId: staff.id,
            tenantId,
            unitId,
            isDeleted: false,
            startAt: { lte: todayEnd },
            OR: [
                { endAt: null },
                { endAt: { gte: todayStart } }
            ]
        },
        include: assignmentInclude,
        orderBy: { startAt: 'asc' }
    });
    
    const assignments = rawAssignments.map(mapAssignmentResponse);
    const assignmentIds = assignments.map(a => a.id);`);

fs.writeFileSync(filePath, code);
console.log('Modifications applied successfully.');
