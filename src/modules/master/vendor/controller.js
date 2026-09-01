import { successResponse } from '../../../shared/utils/response.js';
import { vendorSchema } from './schema.js';
import * as vendorService from './service.js';

export const handleCreateVendor = async (req, res, next) => {
    try {
        const data = vendorSchema.parse(req.body);
        const record = await vendorService.createVendor(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'Vendor created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetVendors = async (req, res, next) => {
    try {
        const records = await vendorService.getVendors(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, 'Vendors retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdateVendor = async (req, res, next) => {
    try {
        const data = vendorSchema.partial().parse(req.body);
        const record = await vendorService.updateVendor(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'Vendor updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDeleteVendor = async (req, res, next) => {
    try {
        await vendorService.deleteVendor(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, 'Vendor deleted successfully');
    } catch (error) {
        next(error);
    }
};
