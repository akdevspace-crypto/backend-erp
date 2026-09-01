import { catchAsync } from '../../shared/utils/catchAsync.js';
import * as closureService from './service.js';

export const startOrFetchClosure = catchAsync(async (req, res) => {
    const { admissionId } = req.params;
    const ctx = {
        tenantId: req.context.tenantId,
        unitId: req.context.unitId,
        userId: req.user.id
    };
    const data = await closureService.startOrFetchClosure(admissionId, ctx);
    res.json({ success: true, data });
});

export const clearRequirement = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { type, notes } = req.body;
    const ctx = {
        tenantId: req.context.tenantId,
        unitId: req.context.unitId,
        userId: req.user.id
    };
    const data = await closureService.clearRequirement(id, { type, notes }, ctx);
    res.json({ success: true, data });
});

export const executeClosure = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { closingRemarks } = req.body;
    const ctx = {
        tenantId: req.context.tenantId,
        unitId: req.context.unitId,
        userId: req.user.id
    };
    const data = await closureService.executeClosure(id, { closingRemarks }, ctx);
    res.json({ success: true, data });
});

export const getClosures = catchAsync(async (req, res) => {
    const ctx = {
        tenantId: req.context.tenantId,
        unitId: req.context.unitId,
        userId: req.user.id
    };
    const filters = {};
    if (req.query.status) {
        filters.status = req.query.status;
    }
    const data = await closureService.getClosures(filters, ctx);
    res.json({ success: true, data });
});
