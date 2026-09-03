import * as service from './dashboard.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getDashboardSummary = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const includeTenantWide = canAccessTenantSecurityLogs(req);

        const summary = await service.getSecurityDashboardSummary(tenantId, unitId, includeTenantWide);
        return successResponse(res, summary, 'Security dashboard summary retrieved successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const getActionQueueController = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const includeTenantWide = canAccessTenantSecurityLogs(req);

        const queue = await service.getActionQueue({ tenantId, unitId, includeTenantWide });
        return successResponse(res, queue, 'Security action queue retrieved successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};
