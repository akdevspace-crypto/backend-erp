import { createUnit, getUnits, updateUnit, deleteUnit } from './service.js';
import { success } from '../../../shared/utils/response.js';
import { unitSchema } from './schema.js';
import { resolveUserAccess } from '../../auth/access.js';

export const handleCreateUnit = async (req, res, next) => {
    try {
        const data = unitSchema.parse(req.body);
        const unit = await createUnit(req.user.tenantId, data);
        return success(res, unit, { message: 'Unit created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetAuthorizedUnits = async (req, res, next) => {
    try {
        const units = await getUnits(req.user.tenantId);
        
        const { unitAccess, permissions } = resolveUserAccess(req.user);
        const hasAllAccess = permissions?.includes('ALL_ACCESS') || unitAccess?.includes('*');

        const authorizedUnits = (units || []).filter(unit => {
            if (hasAllAccess) return true;
            return unitAccess?.includes(unit.id);
        });

        console.log('API /master/unit/authorized hit by user:', req.user.email);
        console.log('hasAllAccess:', hasAllAccess);
        console.log('authorizedUnits count:', authorizedUnits.length);

        return success(res, authorizedUnits);
    } catch (error) {
        next(error);
    }
};

export const handleGetUnits = async (req, res, next) => {
    try {
        const units = await getUnits(req.user.tenantId);
        return success(res, units);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateUnit = async (req, res, next) => {
    try {
        const data = unitSchema.parse(req.body);
        const unit = await updateUnit(req.params.id, req.user.tenantId, data);
        return success(res, unit, { message: 'Unit updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteUnit = async (req, res, next) => {
    try {
        await deleteUnit(req.params.id, req.user.tenantId);
        return success(res, null, { message: 'Unit deleted successfully' });
    } catch (error) {
        next(error);
    }
};
