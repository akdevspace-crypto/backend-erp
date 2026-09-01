import { successResponse } from '../../../shared/utils/response.js';
import { paymentCategorySchema } from './schema.js';
import * as paymentCategoryService from './service.js';

export const handleCreatePaymentCategory = async (req, res, next) => {
    try {
        const data = paymentCategorySchema.parse(req.body);
        const record = await paymentCategoryService.createPaymentCategory(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'PaymentCategory created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetPaymentCategorys = async (req, res, next) => {
    try {
        const records = await paymentCategoryService.getPaymentCategorys(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, 'PaymentCategorys retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdatePaymentCategory = async (req, res, next) => {
    try {
        const data = paymentCategorySchema.partial().parse(req.body);
        const record = await paymentCategoryService.updatePaymentCategory(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'PaymentCategory updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDeletePaymentCategory = async (req, res, next) => {
    try {
        await paymentCategoryService.deletePaymentCategory(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, 'PaymentCategory deleted successfully');
    } catch (error) {
        next(error);
    }
};
