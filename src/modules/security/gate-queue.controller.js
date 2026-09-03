import { getActiveGateQueue } from './gate-queue.service.js';

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getGateQueueController = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const includeTenant = canAccessTenantSecurityLogs(req);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const result = await getActiveGateQueue({
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            includeTenant,
            startOfDay
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
};
