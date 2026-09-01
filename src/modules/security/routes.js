import { Router } from 'express';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { requirePermission } from '../../shared/middleware/rbac.middleware.js';
import { getOtpSummariesForReferences, hasVerifiedOtpForReference, listOtpLogs, otpPurposes, requestOtp, verifyOtp } from './otp.service.js';

const router = Router();

const moduleName = 'SECURITY_GATE';
const canReadSecurity = requirePermission('SECURITY', 'READ');
const canCreateSecurity = requirePermission('SECURITY', 'CREATE');
const canUpdateSecurity = requirePermission('SECURITY', 'UPDATE');

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

const buildSecurityWhere = (req, scope, extra = {}) => ({
    tenantId: scope.tenantId,
    ...(canAccessTenantSecurityLogs(req) ? {} : { unitId: scope.unitId }),
    module: moduleName,
    isDeleted: false,
    ...extra
});

const normalizeString = (value) => String(value || '').trim();

const readVisitorPayload = (body) => ({
    visitorName: normalizeString(body.visitorName),
    mobile: normalizeString(body.mobile),
    purpose: normalizeString(body.purpose),
    visitingPerson: normalizeString(body.visitingPerson),
    department: normalizeString(body.department),
    vehicleNo: normalizeString(body.vehicleNo),
    remarks: normalizeString(body.remarks),
    expectedAt: normalizeString(body.expectedAt)
});

const readVehiclePayload = (body) => ({
    vehicleNo: normalizeString(body.vehicleNo).toUpperCase(),
    vehicleType: normalizeString(body.vehicleType),
    driverName: normalizeString(body.driverName),
    driverMobile: normalizeString(body.driverMobile),
    purpose: normalizeString(body.purpose),
    companyName: normalizeString(body.companyName),
    materialDetails: normalizeString(body.materialDetails),
    remarks: normalizeString(body.remarks)
});

const readStaffPayload = (body) => ({
    staffName: normalizeString(body.staffName),
    empId: normalizeString(body.empId),
    department: normalizeString(body.department),
    designation: normalizeString(body.designation),
    mobile: normalizeString(body.mobile),
    purpose: normalizeString(body.purpose),
    remarks: normalizeString(body.remarks)
});

const normalizeEntry = (entry) => {
    if (entry.entryType === 'VISITOR_PASS') return entry;
    return {
        id: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        tenantId: entry.tenantId,
        unitId: entry.unitId,
        recordedBy: entry.user?.firstName || entry.user?.email || entry.payload?.recordedBy || '-',
        ...(entry.payload || {})
    };
};

const normalizeEntriesWithOtp = async (req, scope, entries) => {
    const otpSummaries = await getOtpSummariesForReferences({
        tenantId: scope.tenantId,
        unitId: scope.unitId,
        referenceIds: entries.map((entry) => entry.id),
        includeTenant: canAccessTenantSecurityLogs(req)
    });

    return entries.map((entry) => ({
        ...normalizeEntry(entry),
        otpVerification: otpSummaries.get(entry.id) || {}
    }));
};

router.get('/gate-entries', auth, enforceTenant, canReadSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const auditLogEntries = await prisma.auditLog.findMany({
            where: buildSecurityWhere(req, scope),
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const visitorPasses = await prisma.visitorPass.findMany({
            where: {
                tenantId: scope.tenantId,
                ...(canAccessTenantSecurityLogs(req) ? {} : { unitId: scope.unitId }),
                OR: [
                    { checkInAt: { not: null }, checkOutAt: null }, // Currently inside
                    { createdAt: { gte: startOfDay } }, // Registered today
                    { expectedAt: { gte: startOfDay } }, // Expected today
                    { checkOutAt: { gte: startOfDay } } // Checked out today
                ]
            },
            include: {
                visitor: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const mappedVisitorPasses = visitorPasses.map(vp => {
            let status = 'Expected';
            if (vp.checkOutAt) status = 'Checked Out';
            else if (vp.checkInAt) status = 'Checked In';
            else if (vp.status === 'PENDING') status = 'Pending';
            else status = 'Registered';

            return {
                id: vp.id,
                createdAt: vp.createdAt,
                updatedAt: vp.updatedAt,
                tenantId: vp.tenantId,
                unitId: vp.unitId,
                recordedBy: vp.user?.firstName || vp.user?.email || vp.recordedBy || 'Front Desk',
                entryType: 'VISITOR_PASS',
                visitorName: vp.visitor?.name,
                mobile: vp.visitor?.mobile,
                photoUrl: vp.visitor?.photoUrl,
                category: vp.visitor?.category,
                purpose: vp.purpose,
                visitingPerson: vp.hostName,
                department: vp.department,
                vehicleNo: vp.vehicleNo,
                remarks: vp.materialDetails || '',
                expectedAt: vp.expectedAt,
                checkInAt: vp.checkInAt,
                checkOutAt: vp.checkOutAt,
                status: status
            };
        });

        const combined = [...auditLogEntries, ...mappedVisitorPasses];
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({ success: true, data: await normalizeEntriesWithOtp(req, scope, combined) });
    } catch (error) {
        next(error);
    }
});

router.post('/vehicle-entries', auth, enforceTenant, canCreateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { vehicleNo, vehicleType, driverName, driverMobile, purpose, companyName, materialDetails, remarks } = readVehiclePayload(req.body);

        if (!vehicleNo) throw buildHttpError('Vehicle number is required');
        if (!driverName) throw buildHttpError('Driver name is required');
        if (!purpose) throw buildHttpError('Vehicle purpose is required');

        const now = new Date().toISOString();
        const created = await prisma.auditLog.create({
            data: {
                userId: scope.userId,
                module: moduleName,
                action: 'VEHICLE_CHECK_IN',
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                payload: {
                    entryType: 'VEHICLE',
                    vehicleNo,
                    vehicleType,
                    driverName,
                    driverMobile,
                    purpose,
                    companyName,
                    materialDetails,
                    remarks,
                    status: 'Checked In',
                    checkInAt: now,
                    checkOutAt: null,
                    recordedBy: req.user?.name || req.user?.email || 'Security'
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json({ success: true, data: normalizeEntry(created), message: 'Vehicle checked in successfully' });
    } catch (error) {
        next(error);
    }
});

router.post('/staff-entries', auth, enforceTenant, canCreateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { staffName, empId, department, designation, mobile, purpose, remarks } = readStaffPayload(req.body);

        if (!staffName) throw buildHttpError('Staff name is required');
        if (!empId) throw buildHttpError('Employee ID is required');
        if (!purpose) throw buildHttpError('Movement purpose is required');

        const now = new Date().toISOString();
        const created = await prisma.auditLog.create({
            data: {
                userId: scope.userId,
                module: moduleName,
                action: 'STAFF_CHECK_IN',
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                payload: {
                    entryType: 'STAFF',
                    staffName,
                    empId,
                    department,
                    designation,
                    mobile,
                    purpose,
                    remarks,
                    status: 'Checked In',
                    checkInAt: now,
                    checkOutAt: null,
                    recordedBy: req.user?.name || req.user?.email || 'Security'
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            }
        });

        // Sync with HR AttendanceLog
        try {
            const staff = await prisma.staff.findFirst({
                where: { tenantId: scope.tenantId, empId, isDeleted: false }
            });
            if (staff) {
                const today = new Date().toISOString().split('T')[0];
                const existingLog = await prisma.attendanceLog.findFirst({
                    where: { staffId: staff.id, date: new Date(today) }
                });
                if (!existingLog) {
                    await prisma.attendanceLog.create({
                        data: {
                            staffId: staff.id,
                            date: new Date(today),
                            checkIn: new Date(now),
                            method: 'SECURITY_GATE',
                            metadata: { status: 'Present' },
                            tenantId: scope.tenantId,
                            unitId: staff.unitId || scope.unitId
                        }
                    });
                } else if (!existingLog.checkIn) {
                    await prisma.attendanceLog.update({
                        where: { id: existingLog.id },
                        data: { checkIn: new Date(now) }
                    });
                }
            }
        } catch (err) {
            console.error('Error syncing Security Check-In to AttendanceLog:', err);
        }

        res.status(201).json({ success: true, data: normalizeEntry(created), message: 'Staff checked in successfully' });
    } catch (error) {
        next(error);
    }
});

router.post('/expected-visitors', auth, enforceTenant, canCreateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { visitorName, mobile, purpose, visitingPerson, department, vehicleNo, remarks, expectedAt } = readVisitorPayload(req.body);

        if (!visitorName) throw buildHttpError('Visitor name is required');
        if (!mobile) throw buildHttpError('Visitor mobile is required');
        if (!purpose) throw buildHttpError('Visit purpose is required');

        const created = await prisma.auditLog.create({
            data: {
                userId: scope.userId,
                module: moduleName,
                action: 'VISITOR_EXPECTED',
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                payload: {
                    entryType: 'VISITOR',
                    visitorName,
                    mobile,
                    purpose,
                    visitingPerson,
                    department,
                    vehicleNo,
                    remarks,
                    expectedAt: expectedAt || null,
                    status: 'Expected',
                    checkInAt: null,
                    checkOutAt: null,
                    recordedBy: req.user?.name || req.user?.email || 'Security'
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            }
        });

        res.status(201).json({ success: true, data: normalizeEntry(created), message: 'Expected visitor saved successfully' });
    } catch (error) {
        next(error);
    }
});

router.patch('/expected-visitors/:id/check-in', auth, enforceTenant, canUpdateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const id = normalizeString(req.params.id);
        if (!id) throw buildHttpError('Expected visitor id is required');

        const existing = await prisma.auditLog.findFirst({
            where: buildSecurityWhere(req, scope, { id })
        });

        if (!existing) throw buildHttpError('Expected visitor not found', 404);

        const payload = existing.payload && typeof existing.payload === 'object' ? existing.payload : {};
        if (payload.status !== 'Expected') {
            throw buildHttpError('Only expected visitors can be checked in from this queue');
        }

        const updated = await prisma.auditLog.update({
            where: { id: existing.id },
            data: {
                action: 'VISITOR_CHECK_IN',
                payload: {
                    ...payload,
                    status: 'Checked In',
                    checkInAt: new Date().toISOString(),
                    checkOutAt: null,
                    arrivalRemarks: normalizeString(req.body.remarks)
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            }
        });

        res.json({ success: true, data: normalizeEntry(updated), message: 'Expected visitor checked in successfully' });
    } catch (error) {
        next(error);
    }
});

router.patch('/gate-entries/:id/checkout', auth, enforceTenant, canUpdateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const id = normalizeString(req.params.id);
        if (!id) throw buildHttpError('Gate entry id is required');

        const visitorPass = await prisma.visitorPass.findFirst({
            where: {
                id,
                tenantId: scope.tenantId,
                ...(canAccessTenantSecurityLogs(req) ? {} : { unitId: scope.unitId })
            }
        });

        if (visitorPass) {
            if (visitorPass.checkOutAt) throw buildHttpError('Visitor is already checked out');

            /*
            const hasCheckoutOtp = await hasVerifiedOtpForReference({
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                referenceId: visitorPass.id,
                purpose: otpPurposes.visitorCheckout,
                includeTenant: canAccessTenantSecurityLogs(req)
            });

            if (!hasCheckoutOtp) throw buildHttpError('Visitor checkout requires verified checkout OTP');
            */

            const updated = await prisma.visitorPass.update({
                where: { id: visitorPass.id },
                data: { checkOutAt: new Date().toISOString() }
            });

            return res.json({
                success: true,
                data: {
                    id: updated.id,
                    entryType: 'VISITOR_PASS',
                    status: 'Checked Out',
                    checkOutAt: updated.checkOutAt
                },
                message: 'Visitor checked out successfully'
            });
        }

        const existing = await prisma.auditLog.findFirst({
            where: buildSecurityWhere(req, scope, { id })
        });

        if (!existing) throw buildHttpError('Gate entry not found', 404);

        const payload = existing.payload && typeof existing.payload === 'object' ? existing.payload : {};
        if (payload.status === 'Checked Out') {
            throw buildHttpError('Gate entry is already checked out');
        }

        const entryType = payload.entryType === 'VEHICLE' ? 'VEHICLE' : payload.entryType === 'STAFF' ? 'STAFF' : 'VISITOR';
        if (entryType === 'VISITOR') {
            /*
            const hasCheckoutOtp = await hasVerifiedOtpForReference({
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                referenceId: existing.id,
                purpose: otpPurposes.visitorCheckout,
                includeTenant: canAccessTenantSecurityLogs(req)
            });

            if (!hasCheckoutOtp) {
                throw buildHttpError('Visitor checkout requires verified checkout OTP');
            }
            */
        }

        const updated = await prisma.auditLog.update({
            where: { id: existing.id },
            data: {
                action: entryType === 'VEHICLE' ? 'VEHICLE_CHECK_OUT' : entryType === 'STAFF' ? 'STAFF_CHECK_OUT' : 'VISITOR_CHECK_OUT',
                payload: {
                    ...payload,
                    status: 'Checked Out',
                    checkOutAt: new Date().toISOString(),
                    checkoutRemarks: normalizeString(req.body.remarks)
                }
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        email: true
                    }
                }
            }
        });

        // Sync with HR AttendanceLog
        if (entryType === 'STAFF' && payload.empId) {
            try {
                const staff = await prisma.staff.findFirst({
                    where: { tenantId: scope.tenantId, empId: payload.empId, isDeleted: false }
                });
                if (staff) {
                    const checkOutTime = updated.payload.checkOutAt;
                    const checkInDate = updated.payload.checkInAt ? new Date(updated.payload.checkInAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                    const existingLog = await prisma.attendanceLog.findFirst({
                        where: { staffId: staff.id, date: new Date(checkInDate) }
                    });
                    if (existingLog && !existingLog.checkOut) {
                        await prisma.attendanceLog.update({
                            where: { id: existingLog.id },
                            data: { checkOut: new Date(checkOutTime) }
                        });
                    }
                }
            } catch (err) {
                console.error('Error syncing Security Check-Out to AttendanceLog:', err);
            }
        }

        res.json({
            success: true,
            data: normalizeEntry(updated),
            message: entryType === 'VEHICLE' ? 'Vehicle checked out successfully' : entryType === 'STAFF' ? 'Staff checked out successfully' : 'Visitor checked out successfully'
        });
    } catch (error) {
        next(error);
    }
});

router.get('/otp-logs', auth, enforceTenant, canReadSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const logs = await listOtpLogs({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            includeTenant: canAccessTenantSecurityLogs(req)
        });

        res.json({ success: true, data: logs });
    } catch (error) {
        next(error);
    }
});

router.post('/otp/request', auth, enforceTenant, canCreateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const result = await requestOtp({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            userId: scope.userId,
            userName: req.user?.name || req.user?.email || 'Security',
            mobile: req.body.mobile,
            purpose: req.body.purpose,
            referenceId: req.body.referenceId
        });

        res.status(201).json({
            success: true,
            data: result.log,
            developmentOtp: result.developmentOtp,
            message: result.developmentOtp
                ? 'OTP created for development. SMS delivery is not configured.'
                : 'OTP sent successfully'
        });
    } catch (error) {
        next(error);
    }
});

router.post('/otp/:id/verify', auth, enforceTenant, canUpdateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const log = await verifyOtp({
            id: normalizeString(req.params.id),
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            includeTenant: canAccessTenantSecurityLogs(req),
            otp: req.body.otp
        });

        req.body.otp = '[REDACTED]';
        res.json({ success: true, data: log, message: 'OTP verified successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
