const fs = require('fs');

const file = 'F:\\ERP\\Backend\\src\\modules\\hr\\service.js';
let content = fs.readFileSync(file, 'utf8');

// Replace getMyLeaveRequests
const getMyLeaveRequestsOld = `export const getMyLeaveRequests = async (tenantId, userId) => {
    const staff = await prisma.staff.findFirst({
        where: {
            tenantId,
            userId,
            isDeleted: false
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            metadata: true
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    const metadata = parseMetadata(staff.metadata);
    const leaveRequests = Array.isArray(metadata.leaveRequests) ? metadata.leaveRequests : [];
    return leaveRequests
        .map((request) => mapLeaveRequest(staff, request))
        .sort((a, b) => new Date(b.requestedAt || b.fromDate).getTime() - new Date(a.requestedAt || a.fromDate).getTime());
};`;

const getMyLeaveRequestsNew = `export const getMyLeaveRequests = async (tenantId, userId) => {
    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true, metadata: true }
    });
    if (!staff) throw buildHttpError('No staff profile is linked to this login', 404);
    
    const unitName = staff.unitId ? (await prisma.unit.findUnique({ where: { id: staff.unitId } }))?.name || staff.unitId : staff.unitId;
    const staffObj = { ...staff, unitName };

    const metadata = parseMetadata(staff.metadata);
    const jsonLeaveRequests = Array.isArray(metadata.leaveRequests) ? metadata.leaveRequests : [];
    
    const relationalRequests = await prisma.leaveRequest.findMany({
        where: { staffId: staff.id },
        orderBy: { createdAt: 'desc' }
    });
    
    const combinedMap = new Map();
    jsonLeaveRequests.forEach(req => combinedMap.set(req.id, mapLeaveRequest(staffObj, req)));
    relationalRequests.forEach(req => combinedMap.set(req.id, mapLeaveRequest(staffObj, req)));
    
    return Array.from(combinedMap.values()).sort((a, b) => new Date(b.requestedAt || b.fromDate).getTime() - new Date(a.requestedAt || a.fromDate).getTime());
};`;
content = content.replace(getMyLeaveRequestsOld, getMyLeaveRequestsNew);

// Replace createLeaveRequest
const createLeaveRequestOld = `export const createLeaveRequest = async (tenantId, unitId, data, requestedBy) => {
    const fromDate = toLeaveDate(data.fromDate, 'From date');
    const toDate = toLeaveDate(data.toDate, 'To date');

    if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
        throw buildHttpError('To date must be same or after from date');
    }

    const staff = await prisma.staff.findFirst({
        where: {
            id: data.staffId,
            tenantId,
            unitId,
            isDeleted: false
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            metadata: true
        }
    });

    if (!staff) {
        throw buildHttpError('Selected staff not found for this unit', 404);
    }

    const metadata = parseMetadata(staff.metadata);
    const leaveRequests = Array.isArray(metadata.leaveRequests) ? [...metadata.leaveRequests] : [];
    const leaveRequest = {
        id: crypto.randomUUID(),
        leaveType: data.leaveType.trim(),
        fromDate,
        toDate,
        reason: data.reason || '',
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
        requestedBy: requestedBy || null
    };

    leaveRequests.unshift(leaveRequest);

    const updatedStaff = await prisma.staff.update({
        where: { id: staff.id },
        data: {
            metadata: {
                ...metadata,
                leaveRequests
            }
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            metadata: true
        }
    });

    return mapLeaveRequest(updatedStaff, leaveRequest);
};`;

const createLeaveRequestNew = `export const createLeaveRequest = async (tenantId, unitId, data, requestedBy) => {
    const fromDate = toLeaveDate(data.fromDate || data.startDate, 'From date');
    const toDate = toLeaveDate(data.toDate || data.endDate, 'To date');

    if (new Date(fromDate).getTime() > new Date(toDate).getTime()) {
        throw buildHttpError('To date must be same or after from date');
    }

    const staff = await prisma.staff.findFirst({
        where: { id: data.staffId, tenantId, unitId, isDeleted: false },
        select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true }
    });

    if (!staff) {
        throw buildHttpError('Selected staff not found for this unit', 404);
    }
    
    const unitName = staff.unitId ? (await prisma.unit.findUnique({ where: { id: staff.unitId } }))?.name || staff.unitId : staff.unitId;

    const leaveRequest = await prisma.leaveRequest.create({
        data: {
            staffId: staff.id,
            tenantId,
            unitId: staff.unitId || unitId,
            leaveType: data.leaveType.trim(),
            startDate: new Date(fromDate),
            endDate: new Date(toDate),
            reason: data.reason || '',
            status: 'PENDING',
            requestedBy: requestedBy || null
        }
    });

    return mapLeaveRequest({ ...staff, unitName }, leaveRequest);
};`;
content = content.replace(createLeaveRequestOld, createLeaveRequestNew);

// Replace updateLeaveRequestStatus
const updateLeaveRequestStatusOld = `export const updateLeaveRequestStatus = async (tenantId, unitId, leaveRequestId, data, decidedBy, options = {}) => {
    const where = {
        tenantId,
        isDeleted: false
    };

    if (options.scope !== 'all') {
        where.unitId = unitId;
    }

    const staff = await prisma.staff.findMany({
        where,
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            metadata: true
        }
    });

    const matchedStaff = staff.find((member) => {
        const metadata = parseMetadata(member.metadata);
        return Array.isArray(metadata.leaveRequests) && metadata.leaveRequests.some((request) => request.id === leaveRequestId);
    });

    if (!matchedStaff) throw buildHttpError('Leave request not found', 404);
    return updateLeaveRequestStatusForStaff(matchedStaff, leaveRequestId, data, decidedBy);
};`;

const updateLeaveRequestStatusNew = `export const updateLeaveRequestStatus = async (tenantId, unitId, leaveRequestId, data, decidedBy, options = {}) => {
    const relationalRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: { staff: { select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true } } }
    });
    
    if (relationalRequest) {
        if (relationalRequest.tenantId !== tenantId) throw buildHttpError('Leave request not found', 404);
        if (options.scope !== 'all' && relationalRequest.unitId !== unitId) throw buildHttpError('Leave request not found', 404);
        if (normalizeLeaveStatus(relationalRequest.status) !== 'PENDING') throw buildHttpError('Only pending leave requests can be approved or rejected');
        
        const updatedRequest = await prisma.leaveRequest.update({
            where: { id: leaveRequestId },
            data: {
                status: data.status,
                remarks: data.remarks || '',
                approvedBy: decidedBy || null
            }
        });
        
        const unitName = relationalRequest.staff.unitId ? (await prisma.unit.findUnique({ where: { id: relationalRequest.staff.unitId } }))?.name || relationalRequest.staff.unitId : relationalRequest.staff.unitId;
        return mapLeaveRequest({ ...relationalRequest.staff, unitName }, updatedRequest);
    }
    
    const where = { tenantId, isDeleted: false };
    if (options.scope !== 'all') where.unitId = unitId;
    const staff = await prisma.staff.findMany({
        where,
        select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true, metadata: true }
    });
    const matchedStaff = staff.find((member) => {
        const metadata = parseMetadata(member.metadata);
        return Array.isArray(metadata.leaveRequests) && metadata.leaveRequests.some((request) => request.id === leaveRequestId);
    });
    if (!matchedStaff) throw buildHttpError('Leave request not found', 404);
    
    return updateLeaveRequestStatusForStaff(matchedStaff, leaveRequestId, data, decidedBy);
};`;
content = content.replace(updateLeaveRequestStatusOld, updateLeaveRequestStatusNew);

const updateLeaveRequestStatusForStaffOld = `const updateLeaveRequestStatusForStaff = async (staff, leaveRequestId, data, decidedBy) => {
    const metadata = parseMetadata(staff.metadata);
    const leaveRequests = Array.isArray(metadata.leaveRequests) ? [...metadata.leaveRequests] : [];
    const requestIndex = leaveRequests.findIndex((request) => request.id === leaveRequestId);

    if (requestIndex < 0) {
        throw buildHttpError('Leave request not found', 404);
    }

    const existing = leaveRequests[requestIndex];
    if (normalizeLeaveStatus(existing.status) !== 'PENDING') {
        throw buildHttpError('Only pending leave requests can be approved or rejected');
    }

    const updatedRequest = {
        ...existing,
        status: data.status,
        remarks: data.remarks || '',
        decidedAt: new Date().toISOString(),
        decidedBy: decidedBy || null
    };
    leaveRequests[requestIndex] = updatedRequest;

    const updatedStaff = await prisma.staff.update({
        where: { id: staff.id },
        data: {
            metadata: {
                ...metadata,
                leaveRequests
            }
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            metadata: true
        }
    });

    return mapLeaveRequest(updatedStaff, updatedRequest);
};`;

const updateLeaveRequestStatusForStaffNew = `const updateLeaveRequestStatusForStaff = async (staff, leaveRequestId, data, decidedBy) => {
    const metadata = parseMetadata(staff.metadata);
    const leaveRequests = Array.isArray(metadata.leaveRequests) ? [...metadata.leaveRequests] : [];
    const requestIndex = leaveRequests.findIndex((request) => request.id === leaveRequestId);

    if (requestIndex < 0) {
        throw buildHttpError('Leave request not found', 404);
    }

    const existing = leaveRequests[requestIndex];
    if (normalizeLeaveStatus(existing.status) !== 'PENDING') {
        throw buildHttpError('Only pending leave requests can be approved or rejected');
    }

    const updatedRequest = {
        ...existing,
        status: data.status,
        remarks: data.remarks || '',
        decidedAt: new Date().toISOString(),
        decidedBy: decidedBy || null
    };
    leaveRequests[requestIndex] = updatedRequest;

    const updatedStaff = await prisma.staff.update({
        where: { id: staff.id },
        data: {
            metadata: {
                ...metadata,
                leaveRequests
            }
        },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            unitId: true,
            metadata: true
        }
    });
    
    const unitName = updatedStaff.unitId ? (await prisma.unit.findUnique({ where: { id: updatedStaff.unitId } }))?.name || updatedStaff.unitId : updatedStaff.unitId;

    return mapLeaveRequest({ ...updatedStaff, unitName }, updatedRequest);
};`;
content = content.replace(updateLeaveRequestStatusForStaffOld, updateLeaveRequestStatusForStaffNew);

fs.writeFileSync(file, content, 'utf8');
console.log('Replacements complete');
