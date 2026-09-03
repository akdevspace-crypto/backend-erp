import { getDailyMovementReport } from './reports.service.js';

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getDailyMovementReportController = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const { date } = req.query;

        // Note: canAccessTenantSecurityLogs returns true if user is a Security Supervisor
        // This allows them to see tenant-wide data. Otherwise, they only see their unit's data.
        const includeTenant = canAccessTenantSecurityLogs(req);

        const report = await getDailyMovementReport({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            date,
            includeTenant
        });

        res.status(200).json({
            status: 'success',
            data: report
        });
    } catch (error) {
        next(error);
    }
};
