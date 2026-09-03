import * as service from './staff.service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { staffEntrySchema, tempExitSchema, returnSchema } from './staff.schema.js';

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getStaffMovements = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = canAccessTenantSecurityLogs(req) ? null : (req.user.unitId || req.unitId);
        
        const filters = {
            status: req.query.status,
            date: req.query.date,
            staffId: req.query.staffId
        };
        
        const movements = await service.getStaffMovements(tenantId, unitId, filters);
        return successResponse(res, movements, 'Staff movements retrieved successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const getStaffMovementById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const { id } = req.params;
        
        const movement = await service.getStaffMovementById(tenantId, unitId, id);
        if (!movement) {
            return errorResponse(res, 'Movement not found', 404);
        }
        return successResponse(res, movement, 'Staff movement retrieved successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const recordStaffEntry = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;

        const validation = staffEntrySchema.safeParse(req.body);
        if (!validation.success) {
            return errorResponse(res, validation.error.errors[0].message, 400);
        }

        const movement = await service.recordStaffEntry(tenantId, unitId, userId, validation.data.staffId);
        return successResponse(res, movement, 'Staff entry recorded successfully', 201);
    } catch (error) {
        const status = error.message.includes('already has an active') ? 409 : 500;
        return errorResponse(res, error.message, status);
    }
};

export const recordTempExit = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;
        const movementId = req.params.id;

        const validation = tempExitSchema.safeParse(req.body);
        if (!validation.success) {
            return errorResponse(res, validation.error.errors[0].message, 400);
        }

        const trip = await service.recordTempExit(tenantId, unitId, userId, movementId, validation.data);
        return successResponse(res, trip, 'Temporary exit recorded successfully', 201);
    } catch (error) {
        const status = error.message.includes('already outside') ? 409 : 500;
        return errorResponse(res, error.message, status);
    }
};

export const recordTempReturn = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;
        const movementId = req.params.id;

        const validation = returnSchema.safeParse(req.body);
        if (!validation.success) {
            return errorResponse(res, validation.error.errors[0].message, 400);
        }

        const trip = await service.recordTempReturn(tenantId, unitId, userId, movementId, validation.data.tripId);
        return successResponse(res, trip, 'Temporary return recorded successfully');
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const recordFinalExit = async (req, res) => {
    try {
        const tenantId = req.user.tenantId || req.tenantId;
        const unitId = req.user.unitId || req.unitId;
        const userId = req.user.id;
        const movementId = req.params.id;

        const movement = await service.recordFinalExit(tenantId, unitId, userId, movementId);
        return successResponse(res, movement, 'Final exit recorded successfully');
    } catch (error) {
        const status = error.message.includes('currently outside') ? 409 : 500;
        return errorResponse(res, error.message, status);
    }
};
