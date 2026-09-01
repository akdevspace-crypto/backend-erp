import {
    createClientPortalComplaint,
    getClientPortalComplaints,
    getClientPortalMedicationSchedules,
    getClientPortalServiceHistory,
    getClientPortalSummary,
    recordClientPortalFeedback,
    getClientPortalVitals,
    getClientPortalADL,
    getClientPortalNutrition
} from './service.js';
import { success } from '../../shared/utils/response.js';

export const handleGetClientPortalSummary = async (req, res, next) => {
    try {
        const summary = await getClientPortalSummary(req.user);
        return success(res, summary);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalServices = async (req, res, next) => {
    try {
        const services = await getClientPortalServiceHistory(req.user);
        return success(res, services);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalMedicines = async (req, res, next) => {
    try {
        const medicines = await getClientPortalMedicationSchedules(req.user);
        return success(res, medicines);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalComplaints = async (req, res, next) => {
    try {
        const complaints = await getClientPortalComplaints(req.user);
        return success(res, complaints);
    } catch (error) {
        next(error);
    }
};

export const handleCreateClientPortalComplaint = async (req, res, next) => {
    try {
        const complaint = await createClientPortalComplaint(req.user, req.body);
        return success(res, complaint, { message: 'Complaint raised successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleRecordClientPortalFeedback = async (req, res, next) => {
    try {
        const result = await recordClientPortalFeedback(req.user, req.params.allocationId, req.body);
        return success(res, result, { message: 'Feedback recorded successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalVitals = async (req, res, next) => {
    try {
        const vitals = await getClientPortalVitals(req.user, req.query.month);
        return success(res, vitals);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalADL = async (req, res, next) => {
    try {
        const adl = await getClientPortalADL(req.user);
        return success(res, adl);
    } catch (error) {
        next(error);
    }
};

export const handleGetClientPortalNutrition = async (req, res, next) => {
    try {
        const nutrition = await getClientPortalNutrition(req.user);
        return success(res, nutrition);
    } catch (error) {
        next(error);
    }
};
