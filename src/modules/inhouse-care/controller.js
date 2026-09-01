import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const createVitalSign = async (req, res) => {
    try {
        const item = await service.createVitalSign(req.user.tenantId, req.user.unitId, req.user.id, req.body);
        return successResponse(res, item, 'Vital sign recorded', 201);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};

export const getVitalsByPatient = async (req, res) => {
    try {
        const items = await service.getVitalsByPatient(req.user.tenantId, req.user.unitId, req.params.patientId);
        return successResponse(res, items);
    } catch (err) {
        return errorResponse(res, err.message, 500);
    }
};
