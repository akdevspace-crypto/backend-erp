const fs = require('fs');
const path = require('path');

const file = path.join('f:', 'ERP', 'Backend', 'src', 'modules', 'security', 'routes.js');
let code = fs.readFileSync(file, 'utf8');

// 1. Update normalizeEntry
const newNormalize = const normalizeEntry = (entry) => {
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
};;
code = code.replace(/const normalizeEntry = \(entry\) => \(\{[\s\S]*?\}\);/, newNormalize);

// 2. Update GET /gate-entries
const oldGet = outer.get('/gate-entries', auth, enforceTenant, canReadSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const entries = await prisma.auditLog.findMany({
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

        res.json({ success: true, data: await normalizeEntriesWithOtp(req, scope, entries) });
    } catch (error) {
        next(error);
    }
});;

const newGet = outer.get('/gate-entries', auth, enforceTenant, canReadSecurity, async (req, res, next) => {
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
                visitor: true,
                user: { select: { firstName: true, email: true } }
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
});;
code = code.replace(oldGet, newGet);

// 3. Update PATCH /gate-entries/:id/checkout
const oldPatch = outer.patch('/gate-entries/:id/checkout', auth, enforceTenant, canUpdateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const id = normalizeString(req.params.id);
        if (!id) throw buildHttpError('Gate entry id is required');

        const existing = await prisma.auditLog.findFirst({
            where: buildSecurityWhere(req, scope, { id })
        });

        if (!existing) throw buildHttpError('Gate entry not found', 404);;

const newPatch = outer.patch('/gate-entries/:id/checkout', auth, enforceTenant, canUpdateSecurity, async (req, res, next) => {
    try {
        const scope = getScope(req);
        const id = normalizeString(req.params.id);
        if (!id) throw buildHttpError('Gate entry id is required');

        // Check if it's a VisitorPass
        const visitorPass = await prisma.visitorPass.findFirst({
            where: {
                id,
                tenantId: scope.tenantId,
                ...(canAccessTenantSecurityLogs(req) ? {} : { unitId: scope.unitId })
            }
        });

        if (visitorPass) {
            if (visitorPass.checkOutAt) throw buildHttpError('Visitor is already checked out');

            const hasCheckoutOtp = await hasVerifiedOtpForReference({
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                referenceId: visitorPass.id,
                purpose: otpPurposes.visitorCheckout,
                includeTenant: canAccessTenantSecurityLogs(req)
            });

            if (!hasCheckoutOtp) throw buildHttpError('Visitor checkout requires verified checkout OTP');

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

        if (!existing) throw buildHttpError('Gate entry not found', 404);;
code = code.replace(oldPatch, newPatch);

fs.writeFileSync(file, code);
console.log('Routes successfully updated!');
