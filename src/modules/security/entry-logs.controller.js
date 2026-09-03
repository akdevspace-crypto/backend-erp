import { getMovementTimeline } from './entry-logs.service.js';

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getMovementTimelineController = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const includeTenant = canAccessTenantSecurityLogs(req);

        const { from, to, page, limit } = req.query;

        const result = await getMovementTimeline({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            includeTenant,
            from,
            to,
            page,
            limit
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
