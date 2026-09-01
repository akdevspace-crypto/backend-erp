import { successResponse } from '../../../shared/utils/response.js';
import { labourServiceSchema } from './schema.js';
import * as labourServiceService from './service.js';

export const handleCreateLabourService = async (req, res, next) => {
    try {
        const data = labourServiceSchema.parse(req.body);
        const record = await labourServiceService.createLabourService(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'LabourService created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetLabourServices = async (req, res, next) => {
    try {
        const records = await labourServiceService.getLabourServices(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, 'LabourServices retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdateLabourService = async (req, res, next) => {
    try {
        const data = labourServiceSchema.partial().parse(req.body);
        const record = await labourServiceService.updateLabourService(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'LabourService updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDeleteLabourService = async (req, res, next) => {
    try {
        await labourServiceService.deleteLabourService(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, 'LabourService deleted successfully');
    } catch (error) {
        next(error);
    }
};
