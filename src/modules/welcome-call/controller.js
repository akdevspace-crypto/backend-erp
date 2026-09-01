import { createWelcomeCall, getWelcomeCalls, updateWelcomeCall } from './service.js';
import { success } from '../../shared/utils/response.js';
import { welcomeCallSchema, updateWelcomeCallSchema } from './schema.js';

export const handleCreateWelcomeCall = async (req, res, next) => {
    try {
        const data = welcomeCallSchema.parse(req.body);
        const record = await createWelcomeCall(req.user.tenantId, req.user.unitId, data);
        return success(res, record, { message: 'Welcome Call recorded successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetWelcomeCalls = async (req, res, next) => {
    try {
        const records = await getWelcomeCalls(req.user.tenantId, req.user.unitId);
        return success(res, records);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateWelcomeCall = async (req, res, next) => {
    try {
        const data = updateWelcomeCallSchema.parse(req.body);
        const record = await updateWelcomeCall(req.user.tenantId, req.user.unitId, req.params.id, data);
        return success(res, record, { message: 'Welcome Call updated successfully' });
    } catch (error) {
        next(error);
    }
};
