import { success } from '../../shared/utils/response.js';
import { listWorkflowTimelines } from './timeline.service.js';

export const handleListWorkflowTimelines = async (req, res, next) => {
    try {
        const normalizedRole = String(req.user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
        const canReadAllUnits = normalizedRole === 'admin' || normalizedRole === 'super admin' || normalizedRole === 'superadmin';
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const result = await listWorkflowTimelines({
            tenantId: req.tenantId,
            unitId: requestedAllUnits && canReadAllUnits ? 'ALL' : req.unitId,
            search: req.query?.search,
            limit: req.query?.limit
        });

        return success(res, result, { message: 'Workflow timelines fetched successfully' });
    } catch (error) {
        next(error);
    }
};
