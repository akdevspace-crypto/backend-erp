import { successResponse } from '../../../shared/utils/response.js';
import { clientServiceSchema } from './schema.js';
import * as clientServiceService from './service.js';

export const handleCreateClientService = async (req, res, next) => {
    try {
        const data = clientServiceSchema.parse(req.body);
        const record = await clientServiceService.createClientService(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'ClientService created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientServices = async (req, res, next) => {
    try {
        const records = await clientServiceService.getClientServices(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, 'ClientServices retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdateClientService = async (req, res, next) => {
    try {
        const data = clientServiceSchema.partial().parse(req.body);
        const record = await clientServiceService.updateClientService(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'ClientService updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDeleteClientService = async (req, res, next) => {
    try {
        await clientServiceService.deleteClientService(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, 'ClientService deleted successfully');
    } catch (error) {
        next(error);
    }
};
