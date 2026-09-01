import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const createWelcomeCall = async (req, res) => {
    try {
        const item = await service.createWelcomeCall(req.user.tenantId, req.user.unitId, req.body);
        return successResponse(res, item, 'Welcome call scheduled', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

export const getWelcomeCalls = async (req, res) => {
    try {
        const items = await service.getWelcomeCalls(req.user.tenantId, req.user.unitId);
        return successResponse(res, items, undefined, 200);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

export const updateWelcomeCall = async (req, res) => {
    try {
        const item = await service.updateWelcomeCall(req.params.id, req.body);
        return successResponse(res, item, 'Welcome call updated', 200);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};
