import { successResponse } from '../../../shared/utils/response.js';
import { departmentSchema } from './schema.js';
import * as departmentService from './service.js';

export const handleCreateDepartment = async (req, res, next) => {
    try {
        const data = departmentSchema.parse(req.body);
        const record = await departmentService.createDepartment(data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'Department created successfully', 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetDepartments = async (req, res, next) => {
    try {
        const records = await departmentService.getDepartments(req.user.unitId, req.user.tenantId);
        return successResponse(res, records, 'Departments retrieved successfully');
    } catch (error) {
        next(error);
    }
};

export const handleUpdateDepartment = async (req, res, next) => {
    try {
        const data = departmentSchema.partial().parse(req.body);
        const record = await departmentService.updateDepartment(req.params.id, data, req.user.unitId, req.user.tenantId);
        return successResponse(res, record, 'Department updated successfully');
    } catch (error) {
        next(error);
    }
};

export const handleDeleteDepartment = async (req, res, next) => {
    try {
        await departmentService.deleteDepartment(req.params.id, req.user.unitId, req.user.tenantId);
        return successResponse(res, null, 'Department deleted successfully');
    } catch (error) {
        next(error);
    }
};
