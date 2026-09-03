import * as vehicleService from './vehicle.service.js';
import { vehicleEntrySchema } from './vehicle.schema.js';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId,
    userId: req.context?.userId || req.user.id
});

const canAccessTenantSecurityLogs = (req) => {
    const roleName = String(req.user?.role || '').trim().toLowerCase();
    return roleName === 'security supervisor' || roleName === 'security manager';
};

export const getVehicleMovements = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const includeTenant = canAccessTenantSecurityLogs(req);
        const unitId = includeTenant ? null : scope.unitId;

        const filters = {
            status: req.query.status,
            date: req.query.date,
            vehicleNo: req.query.vehicleNo
        };

        const movements = await vehicleService.getVehicleMovements(scope.tenantId, unitId, filters);
        res.json({ success: true, data: movements });
    } catch (error) {
        next(error);
    }
};

export const getVehicleMovementById = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const includeTenant = canAccessTenantSecurityLogs(req);
        const unitId = includeTenant ? null : scope.unitId;
        const { id } = req.params;

        if (!id) throw buildHttpError('Movement ID is required');

        const movement = await vehicleService.getVehicleMovementById(scope.tenantId, unitId, id);
        if (!movement) {
            throw buildHttpError('Vehicle movement not found', 404);
        }

        res.json({ success: true, data: movement });
    } catch (error) {
        next(error);
    }
};

export const createVehicleMovement = async (req, res, next) => {
    try {
        const scope = getScope(req);
        
        const validationResult = vehicleEntrySchema.safeParse(req.body);
        if (!validationResult.success) {
            const errorMessages = validationResult.error.errors.map(err => err.message).join(', ');
            throw buildHttpError(`Validation Error: ${errorMessages}`);
        }

        const data = validationResult.data;

        const movement = await vehicleService.createVehicleMovement(
            scope.tenantId,
            scope.unitId,
            scope.userId,
            data
        );

        res.status(201).json({
            success: true,
            message: 'Vehicle checked in successfully',
            data: movement
        });
    } catch (error) {
        if (error.message === 'Vehicle is already inside the facility.') {
            next(buildHttpError(error.message, 400));
        } else {
            next(error);
        }
    }
};

export const exitVehicleMovement = async (req, res, next) => {
    try {
        const scope = getScope(req);
        const includeTenant = canAccessTenantSecurityLogs(req);
        const unitId = includeTenant ? null : scope.unitId;
        const { id } = req.params;

        if (!id) throw buildHttpError('Movement ID is required');

        const movement = await vehicleService.exitVehicleMovement(
            scope.tenantId,
            unitId,
            scope.userId,
            id
        );

        res.json({
            success: true,
            message: 'Vehicle checked out successfully',
            data: movement
        });
    } catch (error) {
        if (error.message === 'Vehicle movement not found or unauthorized.') {
            next(buildHttpError(error.message, 404));
        } else if (error.message === 'Vehicle movement is already completed.') {
            next(buildHttpError(error.message, 400));
        } else {
            next(error);
        }
    }
};
