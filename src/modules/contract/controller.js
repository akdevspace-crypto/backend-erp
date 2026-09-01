import {
    getContractByAdmissionId,
    createDraftContract,
    updateDraftContract,
    activateContract
} from './service.js';
import { success } from '../../shared/utils/response.js';
import { contractDraftSchema, contractUpdateSchema } from './schema.js';

const canReadAllUnits = (user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase();
    return ['admin', 'super admin', 'superadmin', 'finance manager'].includes(normalizedRole);
};

const getRequestScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: String(req.query?.scope || '').trim().toLowerCase() === 'all' && canReadAllUnits(req.user)
        ? 'ALL'
        : (req.context?.unitId || req.user.unitId)
});

export const handleGetContract = async (req, res, next) => {
    try {
        const contract = await getContractByAdmissionId(req.user, req.params.admissionId);
        return success(res, contract, { message: 'Contract retrieved successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateContract = async (req, res, next) => {
    try {
        const data = contractDraftSchema.parse(req.body);
        const contract = await createDraftContract(req.user, data);
        return success(res, contract, { message: 'Service contract drafted successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateContract = async (req, res, next) => {
    try {
        const data = contractUpdateSchema.parse(req.body);
        const contract = await updateDraftContract(req.user, req.params.id, data);
        return success(res, contract, { message: 'Service contract updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleActivateContract = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const contract = await activateContract(req.user, req.params.id, userId);
        return success(res, contract, { message: 'Service contract activated successfully' });
    } catch (error) {
        next(error);
    }
};
