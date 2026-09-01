import { createVitalSign, getVitalSigns, updateVitalSign } from './service.js';
import { success } from '../../shared/utils/response.js';
import { vitalSignSchema, updateVitalSignSchema } from './schema.js';
import { getReadScope } from '../../shared/utils/rbac.js';

export const handleCreateVitalSign = async (req, res, next) => {
    try {
        const data = vitalSignSchema.parse(req.body);
        const userId = req.user.id || req.user.userId;
        const record = await createVitalSign(req.user.tenantId, req.user.unitId, userId, data);
        return success(res, record, { message: 'Vital Sign recorded successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleGetVitalSigns = async (req, res, next) => {
    try {
        const scope = getReadScope(req);
        const records = await getVitalSigns(scope, req.query.patientId);
        return success(res, records);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateVitalSign = async (req, res, next) => {
    try {
        const data = updateVitalSignSchema.parse(req.body);
        const record = await updateVitalSign(req.user.tenantId, req.user.unitId, req.params.id, data);
        return success(res, record, { message: 'Vital Sign updated successfully' });
    } catch (error) {
        next(error);
    }
};
