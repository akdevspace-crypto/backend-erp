import { prisma } from '../../app/prisma.js';
import { getFacilityDateString, getFacilityMidnightUTC } from '../../utils/timezoneUtils.js';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import path from 'path';
import { uploadToSupabase } from '../../shared/utils/supabase.js';
import { saveFileMetadata } from '../storage/service.js';

export const CURRENT_TERMS_VERSION = 'v1.0';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const normalizeOptionalString = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};

const resolveLoginRoleIdentifier = (payload = {}) => (
    normalizeOptionalString(payload.loginRoleId) || normalizeOptionalString(payload.roleId)
);

const staffSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    photoUrl: true,
    designation: true,
    department: true,
    unitId: true,
    phone: true,
    email: true,
    joiningDate: true,
    createdAt: true,
    status: true,
    isDeleted: true,
    deletedAt: true,
    metadata: true,
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
            role: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    }
};

const staffPrivilegeSelect = {
    id: true,
    empId: true,
    firstName: true,
    lastName: true,
    email: true,
    unitId: true,
    userId: true,
    metadata: true,
    user: {
        select: {
            id: true,
            email: true,
            isActive: true,
            roleId: true,
            role: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    }
};

const STAFF_DOCUMENT_FIELDS = {
    aadhaarDocument: {
        key: 'aadhaarDocument',
        label: 'Aadhaar Document',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf']
    },
    resumeDocument: {
        key: 'resumeDocument',
        label: 'Resume',
        allowedMimeTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ],
        allowedExtensions: ['.pdf', '.docx']
    }
};

const verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

const detectMimeFromBuffer = (buffer) => {
    if (!buffer || buffer.length < 4) return null;

    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'application/pdf';
    }

    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }

    if (
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47
    ) {
        return 'image/png';
    }

    if (
        buffer[0] === 0x50 &&
        buffer[1] === 0x4B &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
    ) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    return null;
};

const isValidAadhaarNumber = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!/^[2-9]\d{11}$/.test(digits)) return false;

    let checksum = 0;
    const reversed = digits.split('').reverse().map(Number);

    for (let i = 0; i < reversed.length; i += 1) {
        checksum = verhoeffD[checksum][verhoeffP[i % 8][reversed[i]]];
    }

    return checksum === 0;
};

const parseMetadata = (metadata) => (
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? { ...metadata }
        : {}
);

const normalizeLeaveStatus = (value) => {
    const normalized = String(value || 'PENDING').trim().toUpperCase();
    return ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(normalized) ? normalized : 'PENDING';
};

const isInactiveStaffStatus = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'RESIGNED' || normalized === 'TERMINATED';
};

const toLeaveDate = (value, label) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw buildHttpError(`${label} is invalid`);
    }
    return date.toISOString().split('T')[0];
};

const mapLeaveRequest = (staff, request) => ({
    id: request.id,
    staffId: staff.id,
    unitId: staff.unitId || null,
    unitName: staff.unitName || null,
    empId: staff.empId,
    name: `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.empId,
    department: staff.department || 'General',
    role: staff.designation || 'Staff',
    leaveType: request.leaveType,
    fromDate: toDateOnly(request.startDate || request.fromDate),
    toDate: toDateOnly(request.endDate || request.toDate || request.fromDate),
    reason: request.reason || '',
    status: normalizeLeaveStatus(request.status),
    requestedAt: request.createdAt?.toISOString ? request.createdAt.toISOString() : (request.requestedAt || request.createdAt || null),
    decidedAt: request.updatedAt?.toISOString ? request.updatedAt.toISOString() : (request.decidedAt || null),
    decidedBy: request.approvedBy || request.decidedBy || null,
    remarks: request.remarks || ''
});

const countDaysInclusive = (fromDate, toDate) => {
    const start = new Date(fromDate);
    const end = new Date(toDate || fromDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

    const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
    const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
    return Math.max(1, Math.floor((endUtc - startUtc) / 86400000) + 1);
};

const getMonthRange = (monthValue, tenantTz, unitTz) => {
    let normalized;
    if (/^\d{4}-\d{2}$/.test(String(monthValue || ''))) {
        normalized = String(monthValue);
    } else {
        const todayStr = getFacilityDateString(tenantTz, unitTz);
        normalized = todayStr.slice(0, 7);
    }
    const [year, month] = normalized.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));

    return {
        month: normalized,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        totalDays: end.getUTCDate()
    };
};

const calculateApprovedLeaveDays = (leaveRequests, monthRange) => {
    let leaveDays = 0;
    const startRange = new Date(monthRange.startDate).getTime();
    const endRange = new Date(monthRange.endDate).getTime();

    leaveRequests.forEach(req => {
        if (normalizeLeaveStatus(req.status) !== 'APPROVED') return;
        const reqStart = new Date(req.fromDate || req.startDate).getTime();
        const reqEnd = new Date(req.toDate || req.endDate).getTime();

        if (Number.isNaN(reqStart) || Number.isNaN(reqEnd)) return;

        const effectiveStart = Math.max(startRange, reqStart);
        const effectiveEnd = Math.min(endRange, reqEnd);

        if (effectiveStart <= effectiveEnd) {
            leaveDays += Math.max(1, Math.floor((effectiveEnd - effectiveStart) / 86400000) + 1);
        }
    });

    return leaveDays;
};

const resolvePayrollSnapshot = (staff, monthRange) => {
    const metadata = parseMetadata(staff.metadata);
    const payrollMeta = metadata.payroll && typeof metadata.payroll === 'object' ? metadata.payroll : {};
    const relationalLogs = Array.isArray(staff.attendanceLogs) ? staff.attendanceLogs : [];
    const relationalLeaveRequests = Array.isArray(staff.leaveRequests) ? staff.leaveRequests : [];
    
    const combinedLeaveRequestsMap = new Map();
    relationalLeaveRequests.forEach(req => combinedLeaveRequestsMap.set(req.id, {
        ...req,
        fromDate: toDateOnly(req.startDate),
        toDate: toDateOnly(req.endDate)
    }));
    const leaveRequests = Array.from(combinedLeaveRequestsMap.values());
    
    const monthLogsMap = new Map();
    relationalLogs.forEach((log) => {
        const d = toDateOnly(log.date);
        if (d && d >= monthRange.startDate && d <= monthRange.endDate) {
            monthLogsMap.set(d, {
                status: log.status || 'Present',
                checkIn: log.checkIn,
                checkOut: log.checkOut
            });
        }
    });
    const monthLogs = Array.from(monthLogsMap.values());
    const presentDays = monthLogs.filter((log) => {
        const status = String(log?.status || '').trim().toUpperCase();
        return status === 'PRESENT' || Boolean(log?.checkIn || log?.checkOut);
    }).length;

    const workingDaysRaw = Number(payrollMeta.workingDays);
    const workingDays = !Number.isNaN(workingDaysRaw) && workingDaysRaw > 0 ? workingDaysRaw : 22;
    const leaveDays = calculateApprovedLeaveDays(leaveRequests, monthRange);
    const absentDays = Math.max(0, workingDays - presentDays - leaveDays);

    return {
        workingDays,
        presentDays,
        leaveDays,
        absentDays
    };
};

export const verifyStaffDocumentRelational = async (tenantId, unitId, staffId, documentId, status, user) => {
    if (!status || status !== 'VERIFIED') {
        throw buildHttpError('Invalid status. Only VERIFIED is supported for document verification.', 400);
    }

    const document = await prisma.staffDocument.findFirst({
        where: {
            id: documentId,
            staffId: staffId,
            tenantId: tenantId
        }
    });

    if (!document) {
        throw buildHttpError('Document not found or does not belong to the requested staff member.', 404);
    }

    // Verify user authorization: caller must have 'all' scope or match unitId if restricted
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
    const canAccessAllUnits = [
        'admin',
        'super admin',
        'superadmin',
        'hr manager'
    ].includes(normalizedRole);

    if (!canAccessAllUnits && document.unitId !== unitId) {
        throw buildHttpError('Unauthorized: You do not have permission to verify documents for this unit.', 403);
    }

    return prisma.staffDocument.update({
        where: { id: documentId },
        data: {
            status: 'VERIFIED'
        }
    });
};

const validateStaffDocument = (file, config) => {
    if (!file) return;

    if (!config.allowedMimeTypes.includes(file.mimetype)) {
        throw buildHttpError(`${config.label} has an invalid file type`);
    }

    const extension = path.extname(file.originalname || '').toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
        throw buildHttpError(`${config.label} has an invalid file extension`);
    }

    const detectedMime = detectMimeFromBuffer(file.buffer);
    if (!detectedMime || !config.allowedMimeTypes.includes(detectedMime) || detectedMime !== file.mimetype) {
        throw buildHttpError(`${config.label} failed file signature verification`);
    }
};

const validateStaffCompliance = ({ metadata }) => {
    const normalizedMetadata = parseMetadata(metadata);
    const aadhaarNo = normalizeOptionalString(normalizedMetadata.aadhaarNo);

    if (aadhaarNo && !isValidAadhaarNumber(aadhaarNo)) {
        throw buildHttpError('Invalid Aadhaar number. Please provide a valid 12-digit Aadhaar number.');
    }
};

const buildMenuPrivilegeMetadata = ({ existingMetadata, menuPrivilege }) => ({
    ...(existingMetadata && typeof existingMetadata === 'object' ? existingMetadata : {}),
    menuPrivilege: {
        unitAccessMode: menuPrivilege.unitAccessMode,
        selectedUnitIds: menuPrivilege.selectedUnitIds || [],
        permissions: menuPrivilege.permissions || {},
        configuredAt: new Date().toISOString()
    }
});

const hasConfiguredMenuPrivilege = (metadata) => {
    if (!metadata || typeof metadata !== 'object') return false;

    const menuPrivilege = metadata.menuPrivilege;
    if (!menuPrivilege || typeof menuPrivilege !== 'object') return false;

    const selectedUnitIds = Array.isArray(menuPrivilege.selectedUnitIds) ? menuPrivilege.selectedUnitIds : [];
    const permissions = menuPrivilege.permissions && typeof menuPrivilege.permissions === 'object'
        ? Object.values(menuPrivilege.permissions)
        : [];

    if (menuPrivilege.unitAccessMode === 'all') return true;
    if (selectedUnitIds.length > 0) return true;

    return permissions.some((permission) => (
        permission && typeof permission === 'object' && (permission.view || permission.createUpdate)
    ));
};

const generateStaffEmpId = async (tx, tenantId, unitId) => {
    const prefix = 'EMP';
    const counter = await tx.refCounter.upsert({
        where: {
            prefix_tenantId: {
                prefix,
                tenantId
            }
        },
        update: {
            current: { increment: 1 }
        },
        create: {
            prefix,
            tenantId,
            unitId,
            current: 1
        }
    });

    const padded = String(counter.current).padStart(6, '0');
    return `${prefix}-${padded}`;
};



const createStaffBaseRecord = async (tx, { tenantId, userId, empId, staffData }) => {
    const staffId = crypto.randomUUID();
    const metadataJson = staffData.metadata ? JSON.stringify(staffData.metadata) : null;
    const joiningDate = staffData.joiningDate ? new Date(staffData.joiningDate) : null;
    const now = new Date();

    await tx.$executeRaw`
        INSERT INTO "Staff" (
            "id",
            "empId",
            "firstName",
            "lastName",
            "designation",
            "department",
            "phone",
            "email",
            "joiningDate",
            "status",
            "photoUrl",
            "userId",
            "metadata",
            "tenantId",
            "unitId",
            "isDeleted",
            "deletedAt",
            "createdAt",
            "updatedAt"
        ) VALUES (
            CAST(${staffId} AS uuid),
            ${empId},
            ${staffData.firstName},
            ${staffData.lastName ?? null},
            ${staffData.designation ?? null},
            ${staffData.department ?? null},
            ${staffData.phone ?? null},
            ${staffData.email ?? null},
            ${joiningDate},
            ${staffData.status ?? 'Working'},
            ${staffData.photoUrl ?? null},
            CAST(${userId ?? null} AS uuid),
            CAST(${metadataJson} AS jsonb),
            CAST(${tenantId} AS uuid),
            CAST(${staffData.unitId} AS uuid),
            ${false},
            ${null},
            ${now},
            ${now}
        )
    `;

    return tx.staff.findUnique({
        where: { id: staffId },
        select: staffSelect
    });
};

export const createStaff = async (tenantId, data, files = {}) => {
    const { userId, ...staffData } = data;

    validateStaffCompliance({ metadata: staffData.metadata, files });

    const { empId, ...persistableStaffData } = staffData;
    const targetUnitId = persistableStaffData.unitId;
    const resolvedEmpId = normalizeOptionalString(empId) || await generateStaffEmpId(prisma, tenantId, targetUnitId);

    if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw buildHttpError('Provided User ID does not exist', 404);
        }

        if (user.tenantId !== tenantId) {
            throw buildHttpError('Unauthorized: User belongs to a different tenant', 403);
        }

        if (user.unitId && user.unitId !== targetUnitId) {
            throw buildHttpError('Unauthorized: User unit scope does not match staff unit scope', 403);
        }

        const existingLink = await prisma.staff.findUnique({ where: { userId } });
        if (existingLink) {
            throw buildHttpError('Conflict: Provided User ID is already linked to another Staff profile', 409);
        }
    }

    return await createStaffBaseRecord(prisma, {
        tenantId,
        userId: userId || null,
        empId: resolvedEmpId,
        staffData: persistableStaffData
    });
};

export const getStaffSalary = async (tenantId, unitId, staffId) => {
    const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId, isDeleted: false },
        select: { id: true, unitId: true, salary: true, metadata: true }
    });
    if (!staff) throw buildHttpError('Staff not found', 404);
    if (unitId && staff.unitId !== unitId && staff.unitId) {
        throw buildHttpError('Unauthorized access to staff in another unit', 403);
    }

    if (staff.salary) return staff.salary;

    // Safe fallback to legacy metadata during migration
    const metadata = parseMetadata(staff.metadata);
    const payrollMeta = metadata.payroll && typeof metadata.payroll === 'object' ? metadata.payroll : {};
    return {
        monthlySalary: Number(payrollMeta.monthlySalary ?? payrollMeta.grossPay ?? metadata.monthlySalary ?? metadata.salary ?? 0),
        fixedAllowance: Number(payrollMeta.fixedAllowance ?? metadata.fixedAllowance ?? 0),
        fixedDeduction: Number(payrollMeta.fixedDeduction ?? metadata.fixedDeduction ?? 0)
    };
};

export const updateStaffSalary = async (tenantId, unitId, staffId, data) => {
    const staff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId, isDeleted: false },
        select: { id: true, unitId: true }
    });
    if (!staff) throw buildHttpError('Staff not found', 404);
    if (unitId && staff.unitId !== unitId && staff.unitId) {
        throw buildHttpError('Unauthorized access to staff in another unit', 403);
    }

    return prisma.staffSalary.upsert({
        where: { staffId },
        update: {
            monthlySalary: data.monthlySalary,
            fixedAllowance: data.fixedAllowance,
            fixedDeduction: data.fixedDeduction
        },
        create: {
            staffId,
            tenantId,
            unitId: staff.unitId || tenantId,
            monthlySalary: data.monthlySalary,
            fixedAllowance: data.fixedAllowance,
            fixedDeduction: data.fixedDeduction
        }
    });
};

export const updateStaff = async (tenantId, staffId, data, files = {}) => {
    const { userId, ...persistableData } = data;

    const existingStaff = await prisma.staff.findFirst({
        where: { id: staffId, tenantId },
        select: { metadata: true }
    });

    if (!existingStaff) {
        throw buildHttpError('Staff member not found', 404);
    }

    const existingMetadata = parseMetadata(existingStaff.metadata);
    const incomingMetadata = parseMetadata(persistableData.metadata);
    const incomingPayroll = incomingMetadata.payroll && typeof incomingMetadata.payroll === 'object' ? incomingMetadata.payroll : {};
    const existingPayroll = existingMetadata.payroll && typeof existingMetadata.payroll === 'object' ? existingMetadata.payroll : {};

    persistableData.metadata = {
        ...existingMetadata,
        ...incomingMetadata,
        payroll: {
            ...existingPayroll,
            ...incomingPayroll,
            monthlySalary: Number(incomingPayroll.monthlySalary ?? existingPayroll.monthlySalary ?? 0),
            fixedAllowance: Number(incomingPayroll.fixedAllowance ?? existingPayroll.fixedAllowance ?? 0),
            fixedDeduction: Number(incomingPayroll.fixedDeduction ?? existingPayroll.fixedDeduction ?? 0),
            salaryType: incomingPayroll.salaryType || existingPayroll.salaryType || 'Monthly'
        }
    };

    const normalizedEmpId = normalizeOptionalString(persistableData.empId);
    if (normalizedEmpId) {
        persistableData.empId = normalizedEmpId;
    } else {
        delete persistableData.empId;
    }

    validateStaffCompliance({ metadata: persistableData.metadata, files });

    if (userId !== undefined) {
        if (userId) {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                throw buildHttpError('Provided User ID does not exist', 404);
            }

            if (user.tenantId !== tenantId) {
                throw buildHttpError('Unauthorized: User belongs to a different tenant', 403);
            }

            if (user.unitId && user.unitId !== persistableData.unitId && persistableData.unitId) {
                throw buildHttpError('Unauthorized: User unit scope does not match staff unit scope', 403);
            }

            const existingLink = await prisma.staff.findUnique({ where: { userId } });
            if (existingLink && existingLink.id !== staffId) {
                throw buildHttpError('Conflict: Provided User ID is already linked to another Staff profile', 409);
            }
            persistableData.userId = userId;
        } else {
            persistableData.userId = null;
        }
    }

    return prisma.staff.update({
        where: { id: staffId, tenantId },
        data: persistableData,
        select: staffSelect
    });
};

export const getStaff = async (tenantId, unitId, options = {}) => {
    const { includeFormer = false, scope } = options;
    const where = { tenantId };

    if (scope !== 'all') {
        where.unitId = unitId;
    }

    if (!includeFormer) {
        where.isDeleted = false;
        where.status = {
            notIn: ['Resigned', 'Terminated']
        };
    }

    return prisma.staff.findMany({
        where,
        select: {
            id: true,
            empId: true,
            firstName: true,
            salary: true,
            lastName: true,
            photoUrl: true,
            designation: true,
            department: true,
            unitId: true,
            phone: true,
            email: true,
            joiningDate: true,
            createdAt: true,
            status: true,
            isDeleted: true,
            deletedAt: true,
            ...staffSelect
        },
        orderBy: { createdAt: 'desc' }
    });
};

export const getRoles = async (tenantId) => {
    const defaultRoles = [
        { name: 'Admin', description: 'System administrator role' },
        { name: 'Employee', description: 'Standard employee role' },
        { name: 'UNCF Admin', description: 'UNCF core administrator' },
        { name: 'Master Data Manager', description: 'UNCF master data manager' },
        { name: 'Finance Manager', description: 'UNCF finance manager' },
        { name: 'HR Manager', description: 'UNCF human resource manager' },
        { name: 'Security Supervisor', description: 'UNCF security supervisor' },
        { name: 'CMS Manager', description: 'UNCF content manager' },
        { name: 'Admin Files Manager', description: 'UNCF admin files manager' },
        { name: 'Profile Task User', description: 'UNCF profile and task user' },
        { name: 'Family Member', description: 'Client and family member portal access' },
        { name: 'Client Family Member', description: 'Family access to client services, feedback, and complaints' },
        { name: 'Elder Care Admin', description: 'UEC organization administrator' },
        { name: 'In-House Care Manager', description: 'UEC in-house care manager' },
        { name: 'Elder Operations Manager', description: 'UEC operations manager' },
        { name: 'Elder Inventory Manager', description: 'UEC inventory manager' },
        { name: 'Task Log Coordinator', description: 'UEC task log coordinator' },
        { name: 'Elder Finance Manager', description: 'UEC finance manager' },
        { name: 'UHC Admin', description: 'UHC organization administrator' },
        { name: 'Patient Care Manager', description: 'UHC patient care manager' },
        { name: 'Medical Monitor Coordinator', description: 'UHC medical monitoring coordinator' },
        { name: 'Care Allocation Manager', description: 'UHC care allocation manager' },
        { name: 'Medical Inventory Manager', description: 'UHC medical inventory manager' },
        { name: 'UA Admin', description: 'UA organization administrator' },
        { name: 'Ambulance Booking Coordinator', description: 'UA ambulance booking coordinator' },
        { name: 'Dispatch Manager', description: 'UA dispatch manager' },
        { name: 'Fleet Manager', description: 'UA fleet manager' },
        { name: 'Ambulance Billing Manager', description: 'UA ambulance billing manager' },
        { name: 'Emergency Call Coordinator', description: 'UA emergency call coordinator' },
        { name: 'UEO Admin', description: 'UEO organization administrator' },
        { name: 'Enquiry Desk Manager', description: 'UEO enquiry desk manager' },
        { name: 'Follow-up Coordinator', description: 'UEO enquiry follow-up coordinator' },
        { name: 'Customer Relations Manager', description: 'UEO customer relations manager' },
        { name: 'Omnichannel Coordinator', description: 'UEO omnichannel coordinator' },
        { name: 'Admissions Coordinator', description: 'UEO admissions coordinator' }
    ];

    for (const role of defaultRoles) {
        await prisma.role.upsert({
            where: {
                name_tenantId: {
                    name: role.name,
                    tenantId
                }
            },
            update: {
                isDeleted: false,
                deletedAt: null,
                description: role.description
            },
            create: {
                name: role.name,
                description: role.description,
                tenantId
            }
        });
    }

    return prisma.role.findMany({
        where: { tenantId, isDeleted: false },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });
};

export const getStaffPerformance = async (tenantId, unitId) => {
    return prisma.staff.findMany({
        where: { tenantId, unitId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            department: true,
            designation: true,
            performanceScore: true,
            workload: true,
            stressLevel: true,
            isAvailable: true,
            lastActiveAt: true
        },
        orderBy: [
            { performanceScore: 'desc' },
            { workload: 'asc' }
        ]
    });
};

const toDateOnly = (value) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
};

const formatTimeValue = (value) => {
    if (!value) return '-';

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '-';

        if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
            const [hoursRaw, minutesRaw] = trimmed.split(':');
            const hours = Number(hoursRaw);
            const minutes = Number(minutesRaw);
            if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
            const suffix = hours >= 12 ? 'PM' : 'AM';
            const normalizedHours = hours % 12 || 12;
            return `${String(normalizedHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }

        return trimmed;
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};

const resolveAttendanceSnapshot = (staff, targetDate) => {
    const relationalLog = Array.isArray(staff.attendanceLogs)
        ? staff.attendanceLogs.find((log) => toDateOnly(log.date) === targetDate)
        : null;

    let checkInRaw = null;
    let checkOutRaw = null;
    let inferredStatus = null;

    if (relationalLog) {
        checkInRaw = relationalLog.checkIn;
        checkOutRaw = relationalLog.checkOut;
        inferredStatus = relationalLog.status;
    }

    const lastActiveDate = toDateOnly(staff.lastActiveAt);
    const inferredPresent = Boolean(checkInRaw || checkOutRaw || lastActiveDate === targetDate);
    let status = inferredStatus || (inferredPresent ? 'Present' : 'Absent');
    if (status === 'Present' && checkOutRaw && staff.shiftEnd) {
        const normalizedCheckOut = formatTimeValue(checkOutRaw);
        const normalizedShiftEnd = formatTimeValue(staff.shiftEnd);
        if (normalizedCheckOut !== '-' && normalizedShiftEnd !== '-' && normalizedCheckOut !== normalizedShiftEnd) {
            const checkOutDate = new Date(`1970-01-01T${String(checkOutRaw).slice(0, 8)}`);
            const shiftEndDate = new Date(`1970-01-01T${String(staff.shiftEnd).slice(0, 8)}`);
            if (!Number.isNaN(checkOutDate.getTime()) && !Number.isNaN(shiftEndDate.getTime()) && checkOutDate > shiftEndDate) {
                status = 'Present (Overtime)';
            }
        }
    }

    return {
        id: staff.id,
        empId: staff.empId,
        name: `${staff.firstName} ${staff.lastName}`.trim(),
        date: targetDate,
        checkIn: formatTimeValue(checkInRaw),
        checkOut: formatTimeValue(checkOutRaw),
        status: inferredPresent || status === 'Present (Overtime)' ? status : 'Absent'
    };
};

export const getAttendanceLogs = async (tenantId, unitId, options = {}) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const unit = unitId ? await prisma.unit.findUnique({ where: { id: unitId }, select: { timezone: true } }) : null;
    const targetDate = toDateOnly(options.date) || getFacilityDateString(tenant?.timezone, unit?.timezone);
    const targetDateUTC = new Date(Date.UTC(Number(targetDate.split('-')[0]), Number(targetDate.split('-')[1]) - 1, Number(targetDate.split('-')[2])));
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
            status: true,
            metadata: true,
            lastActiveAt: true,
            shiftEnd: true,
            attendanceLogs: {
                where: { date: targetDateUTC }
            }
        },
        orderBy: [
            { firstName: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    return staff
        .filter((member) => {
            const empId = String(member.empId || '').trim().toUpperCase();
            return !empId.startsWith('DEMO-') && !empId.startsWith('SEED-') && !isInactiveStaffStatus(member.status);
        })
        .map((member) => resolveAttendanceSnapshot(member, targetDate))
        .filter((log) => log.checkIn !== '-' || log.checkOut !== '-' || log.status !== 'Absent');
};

export const getPayrollPreview = async (tenantId, unitId, options = {}) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const unit = unitId ? await prisma.unit.findUnique({ where: { id: unitId }, select: { timezone: true } }) : null;
    const monthRange = getMonthRange(options.month, tenant?.timezone, unit?.timezone);
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
            status: true,
            salary: true,
            unitId: true,
            metadata: true,
            createdAt: true,
            attendanceLogs: {
                where: {
                    date: {
                        gte: new Date(monthRange.startDate),
                        lte: new Date(monthRange.endDate)
                    }
                }
            },
            leaveRequests: {
                where: {
                    status: 'APPROVED',
                    startDate: { lte: new Date(monthRange.endDate) },
                    endDate: { gte: new Date(monthRange.startDate) }
                }
            },
            payrollRecords: {
                where: {
                    month: monthRange.month
                }
            }
        },
        orderBy: [
            { firstName: 'asc' },
            { createdAt: 'asc' }
        ]
    });

    return staff
        .filter((member) => {
            const empId = String(member.empId || '').trim().toUpperCase();
            return !empId.startsWith('DEMO-') && !empId.startsWith('SEED-') && !isInactiveStaffStatus(member.status);
        })
        .map((member) => resolvePayrollSnapshot(member, monthRange));
};

export const processPayroll = async (tenantId, unitId, data, processedBy, options = {}) => {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const unit = unitId ? await prisma.unit.findUnique({ where: { id: unitId }, select: { timezone: true } }) : null;
    const monthRange = getMonthRange(data.month, tenant?.timezone, unit?.timezone);
    const where = {
        id: data.staffId,
        tenantId,
        isDeleted: false
    };

    if (options.scope !== 'all') {
        where.unitId = unitId;
    }

    const staff = await prisma.staff.findFirst({
        where,
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            designation: true,
            department: true,
            salary: true,
            status: true,
            unitId: true,
            metadata: true,
            attendanceLogs: {
                where: {
                    date: {
                        gte: new Date(monthRange.startDate),
                        lte: new Date(monthRange.endDate)
                    }
                }
            },
            leaveRequests: {
                where: {
                    status: 'APPROVED',
                    startDate: { lte: new Date(monthRange.endDate) },
                    endDate: { gte: new Date(monthRange.startDate) }
                }
            },
            payrollRecords: {
                where: {
                    month: monthRange.month
                }
            }
        }
    });

    if (!staff) {
        throw buildHttpError('Staff not found for payroll processing', 404);
    }

    if (isInactiveStaffStatus(staff.status)) {
        throw buildHttpError('Inactive staff cannot be processed in payroll queue');
    }

    const empId = String(staff.empId || '').trim().toUpperCase();
    if (empId.startsWith('DEMO-') || empId.startsWith('SEED-')) {
        throw buildHttpError('Seed or demo staff cannot be processed for payroll');
    }

    const snapshot = resolvePayrollSnapshot(staff, monthRange);
    if (snapshot.grossPay <= 0) {
        throw buildHttpError('Set salary before processing payroll');
    }

    const processedRecord = await prisma.payrollRecord.upsert({
        where: {
            staffId_month: {
                staffId: staff.id,
                month: snapshot.month
            }
        },
        update: {
            workingDays: snapshot.workingDays,
            presentDays: snapshot.presentDays,
            approvedLeaveDays: snapshot.approvedLeaveDays,
            absentDays: snapshot.absentDays,
            baseSalary: snapshot.baseSalary,
            fixedAllowance: snapshot.fixedAllowance,
            fixedDeduction: snapshot.fixedDeduction,
            grossPay: snapshot.grossPay,
            deductions: snapshot.deductions,
            netPay: snapshot.netPay,
            status: 'Processed',
            processedBy: processedBy || null
        },
        create: {
            staffId: staff.id,
            tenantId,
            unitId: staff.unitId || unitId,
            month: snapshot.month,
            workingDays: snapshot.workingDays,
            presentDays: snapshot.presentDays,
            approvedLeaveDays: snapshot.approvedLeaveDays,
            absentDays: snapshot.absentDays,
            baseSalary: snapshot.baseSalary,
            fixedAllowance: snapshot.fixedAllowance,
            fixedDeduction: snapshot.fixedDeduction,
            grossPay: snapshot.grossPay,
            deductions: snapshot.deductions,
            netPay: snapshot.netPay,
            status: 'Processed',
            processedAt: new Date(),
            processedBy: processedBy || null
        }
    });

    return resolvePayrollSnapshot({ ...staff, payrollRecords: [processedRecord] }, monthRange);
};

export const getMyAttendanceLogs = async (tenantId, userId, options = {}) => {
    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            unitId: true,
            attendanceLogs: true
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const unit = staff.unitId ? await prisma.unit.findUnique({ where: { id: staff.unitId }, select: { timezone: true } }) : null;
    const targetDate = toDateOnly(options.date) || getFacilityDateString(tenant?.timezone, unit?.timezone);

    const relationalLogs = Array.isArray(staff.attendanceLogs) ? staff.attendanceLogs : [];
    
    const allDates = new Set();
    relationalLogs.forEach(log => allDates.add(toDateOnly(log.date)));
    allDates.add(targetDate);
    
    const sortedLogs = Array.from(allDates)
        .map(date => resolveAttendanceSnapshot(staff, date))
        .filter(log => log.checkIn !== '-' || log.checkOut !== '-' || log.status !== 'Absent' || log.date === targetDate)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        
    return sortedLogs;
};

export const markMyAttendance = async (tenantId, userId, data) => {
    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            unitId: true
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { timezone: true } });
    const unit = staff.unitId ? await prisma.unit.findUnique({ where: { id: staff.unitId }, select: { timezone: true } }) : null;

    const today = getFacilityDateString(tenant?.timezone, unit?.timezone);
    const todayUTCDate = getFacilityMidnightUTC(tenant?.timezone, unit?.timezone);
    const now = new Date();

    const existingLog = await prisma.attendanceLog.findFirst({
        where: { staffId: staff.id, date: todayUTCDate }
    });

    let checkIn = existingLog?.checkIn || null;
    let checkOut = existingLog?.checkOut || null;

    if (data.action === 'CHECK_IN') {
        if (checkIn) throw buildHttpError('Attendance already checked in for today');
        checkIn = now;
    }

    if (data.action === 'CHECK_OUT') {
        if (!checkIn) throw buildHttpError('Check in before checking out');
        if (checkOut) throw buildHttpError('Attendance already checked out for today');
        if (now < checkIn) throw buildHttpError('Check out time cannot be earlier than check in time');
        checkOut = now;
    }

    const logMetadata = existingLog?.metadata && typeof existingLog.metadata === 'object' ? existingLog.metadata : {};
    logMetadata.note = data.note || logMetadata.note || '';

    // UPSERT LOGIC
    await prisma.attendanceLog.upsert({
        where: {
            staffId_date: {
                staffId: staff.id,
                date: todayUTCDate
            }
        },
        update: {
            checkIn,
            checkOut,
            status: 'Present',
            metadata: logMetadata,
            updatedAt: now
        },
        create: {
            staffId: staff.id,
            date: todayUTCDate,
            checkIn,
            checkOut,
            status: 'Present',
            method: 'MANUAL',
            metadata: logMetadata,
            tenantId,
            unitId: staff.unitId || tenantId,
            createdAt: now,
            updatedAt: now
        }
    });

    const updatedStaff = await prisma.staff.update({
        where: { id: staff.id },
        data: { lastActiveAt: now },
        select: {
            id: true,
            empId: true,
            firstName: true,
            lastName: true,
            lastActiveAt: true,
            shiftEnd: true,
            attendanceLogs: {
                where: { date: todayUTCDate }
            }
        }
    });

    return resolveAttendanceSnapshot(updatedStaff, today);
};

export const getLeaveRequests = async (tenantId, unitId, options = {}) => {
    const reqWhere = { tenantId, staff: { isDeleted: false } };
    if (options.scope !== 'all') { reqWhere.unitId = unitId; }
    
    const relationalRequests = await prisma.leaveRequest.findMany({
        where: reqWhere,
        include: {
            staff: {
                select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    const unitIds = [...new Set(relationalRequests.map((req) => req.staff.unitId).filter(Boolean))];
    const units = unitIds.length > 0
        ? await prisma.unit.findMany({
            where: { id: { in: unitIds }, tenantId },
            select: { id: true, name: true, shortName: true, code: true }
        }) : [];
    const unitLabelById = new Map(units.map((unit) => [
        unit.id,
        unit.shortName || unit.name || unit.code || unit.id
    ]));
        
    const mappedRelational = relationalRequests.map(req => mapLeaveRequest({
        ...req.staff,
        unitName: unitLabelById.get(req.staff.unitId) || req.staff.unitId
    }, req));
    
    return mappedRelational;
};

export const getMyLeaveRequests = async (tenantId, userId) => {
    const staff = await prisma.staff.findFirst({
        where: { tenantId, userId, isDeleted: false },
        select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true }
    });
    if (!staff) throw buildHttpError('No staff profile is linked to this login', 404);
    
    const unitName = staff.unitId ? (await prisma.unit.findUnique({ where: { id: staff.unitId } }))?.name || staff.unitId : staff.unitId;
    const staffObj = { ...staff, unitName };

    const relationalRequests = await prisma.leaveRequest.findMany({
        where: { staffId: staff.id },
        orderBy: { createdAt: 'desc' }
    });
    
    return relationalRequests.map(req => mapLeaveRequest(staffObj, req));
};

export const createLeaveRequest = async (tenantId, unitId, data, requestedBy) => {
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
    
    const existingLeaves = await prisma.leaveRequest.findMany({
        where: {
            staffId: staff.id,
            status: { notIn: ['REJECTED', 'CANCELLED'] }
        }
    });

    const newStart = new Date(fromDate).getTime();
    const newEnd = new Date(toDate).getTime();
    
    for (const existing of existingLeaves) {
        const existStart = new Date(toDateOnly(existing.startDate)).getTime();
        const existEnd = new Date(toDateOnly(existing.endDate)).getTime();
        
        if (existStart <= newEnd && existEnd >= newStart) {
            throw buildHttpError('An overlapping leave request already exists for this period.');
        }
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
};

export const createMyLeaveRequest = async (tenantId, userId, data) => {
    const staff = await prisma.staff.findFirst({
        where: {
            tenantId,
            userId,
            isDeleted: false
        },
        select: {
            id: true,
            unitId: true
        }
    });

    if (!staff) {
        throw buildHttpError('No staff profile is linked to this login', 404);
    }

    return createLeaveRequest(tenantId, staff.unitId, { ...data, staffId: staff.id }, userId);
};

export const updateLeaveRequestStatus = async (tenantId, unitId, leaveRequestId, data, decidedBy, options = {}) => {
    const relationalRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: { staff: { select: { id: true, empId: true, firstName: true, lastName: true, designation: true, department: true, unitId: true } } }
    });
    
    if (!relationalRequest) {
        throw buildHttpError('Leave request not found', 404);
    }

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
};

export const deleteStaff = async (tenantId, staffId) => {
    return prisma.staff.update({
        where: { id: staffId, tenantId },
        data: { isDeleted: true, deletedAt: new Date() },
        select: staffSelect
    });
};

// --- Job Applications ---

export const createJobApplication = async (tenantId, unitId, data) => {
    return prisma.jobApplication.create({
        data: { ...data, tenantId, unitId }
    });
};

export const updateJobApplication = async (tenantId, unitId, appId, data) => {
    return prisma.jobApplication.update({
        where: { id: appId, tenantId, unitId },
        data
    });
};

export const getJobApplications = async (tenantId, unitId) => {
    return prisma.jobApplication.findMany({
        where: { tenantId, unitId, isDeleted: false },
        orderBy: { createdAt: 'desc' }
    });
};

export const deleteJobApplication = async (tenantId, unitId, appId) => {
    return prisma.jobApplication.update({
        where: { id: appId, tenantId, unitId },
        data: { isDeleted: true, deletedAt: new Date() }
    });
};

export const getLinkableUsers = async (tenantId) => {
    const users = await prisma.user.findMany({
        where: { tenantId, isDeleted: false },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            unit: {
                select: { name: true }
            },
            staff: {
                select: {
                    id: true,
                    empId: true
                }
            }
        },
        orderBy: { firstName: 'asc' }
    });

    return users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        unitName: user.unit?.name || 'Unknown Unit',
        empId: user.staff?.empId || null,
        isLinked: !!user.staff
    }));
};


export const updateStaffMenuPrivilege = async (tenantId, unitId, staffId, menuPrivilege, options = {}) => {
    const { scope } = options;
    const where = { id: staffId, tenantId, isDeleted: false };
    
    if (scope !== 'all') {
        where.unitId = unitId;
    }

    const staff = await prisma.staff.findFirst({
        where,
        select: staffPrivilegeSelect
    });

    if (!staff) {
        throw buildHttpError('Staff not found', 404);
    }

    if (!staff.userId) {
        throw buildHttpError('Staff has no login. Enable login during onboarding.');
    }

    if (!staff.user?.roleId) {
        throw buildHttpError('Staff has no privilege assigned. Assign a role before configuring menu privileges.');
    }

    return prisma.staff.update({
        where: { id: staffId },
        data: {
            metadata: buildMenuPrivilegeMetadata({
                existingMetadata: staff.metadata,
                menuPrivilege
            })
        },
        select: staffSelect
    });
};


const uploadStaffDocumentRelational = async ({ tenantId, unitId, staffId, files }) => {
    const documents = [];
    
    // Verify Staff exists
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
        throw buildHttpError('Staff member not found or unauthorized', 404);
    }
    
    for (const [fieldName, config] of Object.entries(STAFF_DOCUMENT_FIELDS)) {
        const file = files?.[fieldName]?.[0];
        if (!file) continue;
        
        validateStaffDocument(file, config);

        const fileUrl = await uploadToSupabase('Erp_software', file);
        const filePath = `${tenantId}/${unitId}/${staffId}/${file.originalname}`;
        
        const doc = await prisma.staffDocument.create({
            data: {
                staffId,
                tenantId,
                unitId: staff.unitId || unitId,
                documentType: fieldName,
                fileName: file.originalname,
                fileUrl,
                filePath,
                status: fieldName === 'aadhaarDocument' ? 'PENDING_VERIFICATION' : 'UPLOADED'
            }
        });
        documents.push(doc);
    }
    
    return documents;
};

const getStaffDocuments = async (tenantId, unitId, staffId, user) => {
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
        throw buildHttpError('Staff member not found', 404);
    }
    
    const docs = await prisma.staffDocument.findMany({
        where: { staffId, tenantId },
        orderBy: { createdAt: 'desc' }
    });
    return docs;
};

const getDocumentTracker = async (tenantId, unitId, user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
    const canReadAllUnits = ['admin', 'super admin', 'superadmin', 'hr manager'].includes(normalizedRole);
    
    const where = { tenantId };
    if (!canReadAllUnits && unitId) {
        where.unitId = unitId;
    }
    
    const docs = await prisma.staffDocument.findMany({
        where,
        include: {
            staff: { select: { empId: true, firstName: true, lastName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
    
    return docs.map(doc => ({
        id: doc.id,
        staffId: doc.staffId,
        empId: doc.staff?.empId,
        name: `${doc.staff?.firstName || ''} ${doc.staff?.lastName || ''}`.trim(),
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedAt: doc.uploadedAt,
        status: doc.status
    }));
};
export { hasConfiguredMenuPrivilege, uploadStaffDocumentRelational, getStaffDocuments, getDocumentTracker };

export const getCandidates = async (tenantId, unitId) => {
    return await prisma.candidate.findMany({
        where: { tenantId, unitId },
        orderBy: { createdAt: 'desc' },
        include: { interviews: true }
    });
};

export const createCandidate = async (tenantId, unitId, data) => {
    if (data.termsAccepted) {
        data.termsAcceptedAt = new Date();
        data.termsVersion = CURRENT_TERMS_VERSION;
    }
    delete data.termsAccepted;

    return await prisma.candidate.create({
        data: { id: crypto.randomUUID(), updatedAt: new Date(), ...data, tenantId, unitId, serialNo: data.serialNo || 'CAN-' + Date.now() }
    });
};

export const updateCandidate = async (tenantId, unitId, id, data) => {
    if (data.termsAccepted) {
        data.termsAcceptedAt = new Date();
        data.termsVersion = CURRENT_TERMS_VERSION;
    }
    delete data.termsAccepted;
    
    return await prisma.candidate.update({
        where: { id, tenantId, unitId },
        data
    });
};

export const placeCandidate = async (tenantId, unitId, id, data) => {
    const candidate = await prisma.candidate.findFirst({ where: { id, tenantId, unitId } });
    if (!candidate) throw buildHttpError('Candidate not found', 404);
    if (candidate.isPlaced) throw buildHttpError('Candidate is already placed', 400);
    if (!candidate.termsAcceptedAt || candidate.termsVersion !== CURRENT_TERMS_VERSION) {
        throw buildHttpError('Candidate must accept the current Terms & Policies before being converted to Staff.', 400);
    }
    return await prisma.$transaction(async (tx) => {
        const staff = await tx.staff.create({
            data: {
                empId: data.empId || 'EMP-' + Date.now(),
                firstName: candidate.name,
                phone: candidate.mobileNo,
                designation: data.designation || candidate.preferredRole,
                department: data.department || 'General',
                joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
                metadata: candidate.details || {},
                status: 'Working',
                tenantId,
                unitId
            }
        });
        await tx.candidate.update({
            where: { id },
            data: { stage: 'PLACED', isPlaced: true }
        });
        return staff;
    });
};

export const getCandidateInterviews = async (tenantId, unitId, candidateId) => {
    return await prisma.interview.findMany({
        where: { candidateId, tenantId, unitId },
        orderBy: { scheduledAt: 'asc' }
    });
};

export const createInterview = async (tenantId, unitId, candidateId, data) => {
    const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId, unitId } });
    if (!candidate) throw buildHttpError('Candidate not found', 404);
    return await prisma.interview.create({
        data: { ...data, candidateId, tenantId, unitId, scheduledAt: new Date(data.scheduledAt) }
    });
};

export const updateInterview = async (tenantId, unitId, id, data) => {
    const updateData = { ...data };
    if (updateData.scheduledAt) updateData.scheduledAt = new Date(updateData.scheduledAt);
    return await prisma.interview.update({
        where: { id, tenantId, unitId },
        data: updateData
    });
};

export const deleteInterview = async (tenantId, unitId, id) => {
    return await prisma.interview.delete({ where: { id, tenantId, unitId } });
};

export const convertJobApplication = async (tenantId, unitId, id) => {
    const application = await prisma.jobApplication.findFirst({ where: { id, tenantId, unitId, isDeleted: false } });
    if (!application) throw buildHttpError('Job Application not found', 404);
    if (application.followupStatus === 'Converted') throw buildHttpError('Job Application already converted', 400);
    return await prisma.$transaction(async (tx) => {
        const candidate = await tx.candidate.create({
            data: {
                id: crypto.randomUUID(),
                tenantId,
                unitId,
                serialNo: 'CAN-' + Date.now(),
                name: application.applicantName,
                mobileNo: application.mobileNo,
                preferredRole: application.applyFor,
                stage: 'LEAD',
                isPlaced: false,
                updatedAt: new Date(),
                details: { experience: application.experience, location: application.location, email: application.email, resumeUrl: application.resumeUrl }
            }
        });
        await tx.jobApplication.update({
            where: { id },
            data: { followupStatus: 'Converted' }
        });
        return candidate;
    });
};

