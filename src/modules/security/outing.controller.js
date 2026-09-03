import * as service from './outing.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { z } from 'zod';

export const getSecurityOutings = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        
        const outings = await service.getSecurityOutings(tenantId, unitId);
        return successResponse(res, outings, 'Security resident outings retrieved successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const recordPhysicalExit = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;
        const requestId = req.params.id;

        const movement = await service.recordPhysicalExit(tenantId, unitId, userId, requestId);
        return successResponse(res, movement, 'Physical exit recorded successfully', 201);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const recordPhysicalReturn = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;
        const movementId = req.params.id;

        const movement = await service.recordPhysicalReturn(tenantId, unitId, userId, movementId);
        return successResponse(res, movement, 'Physical return recorded successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const createSecurityOuting = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;

        if (!req.body.patientId) {
            return errorResponse(res, 'Patient ID is required', 400);
        }
        if (!req.body.reason) {
            return errorResponse(res, 'Reason is required', 400);
        }
        if (!req.body.destination) {
            return errorResponse(res, 'Destination is required', 400);
        }
        if (!req.body.expectedReturnAt) {
            return errorResponse(res, 'Expected Return Date & Time is required', 400);
        }
        
        const returnDate = new Date(req.body.expectedReturnAt);
        if (Number.isNaN(returnDate.getTime())) {
            return errorResponse(res, 'Expected Return Date & Time is invalid', 400);
        }

        const request = await service.createSecurityOuting(tenantId, unitId, userId, req.body);
        return successResponse(res, request, 'Security outing created successfully', 201);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};
