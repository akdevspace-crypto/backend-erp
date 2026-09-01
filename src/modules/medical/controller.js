import { success } from '../../shared/utils/response.js';
import {
    createMedicalAssignment,
    deleteMedicalAssignment,
    getMedicalAssignmentById,
    getMedicalAssignments,
    getMedicalDashboard,
    getMedicalStaff,
    updateMedicalAssignment,
    updateMedicalAssignmentStatus,
    getDoctorVisits,
    createDoctorVisit,
    updateDoctorVisit,
    getMyShift
} from './service.js';
import {
    createMedicalAssignmentSchema,
    medicalAssignmentQuerySchema,
    updateMedicalAssignmentSchema,
    updateMedicalAssignmentStatusSchema,
    createDoctorVisitSchema,
    updateDoctorVisitSchema
} from './schema.js';

const getScope = (req) => ({
    tenantId: req.context?.tenantId || req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId
});

export const handleCreateMedicalAssignment = async (req, res, next) => {
    try {
        const data = createMedicalAssignmentSchema.parse(req.body);
        const { tenantId, unitId } = getScope(req);
        const assignment = await createMedicalAssignment(tenantId, unitId, req.user?.id, data);
        return success(res, assignment, { message: 'Medical assignment created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetMedicalAssignments = async (req, res, next) => {
    try {
        const filters = medicalAssignmentQuerySchema.parse(req.query);
        const { tenantId, unitId } = getScope(req);
        const assignments = await getMedicalAssignments(tenantId, unitId, filters);
        return success(res, assignments);
    } catch (error) {
        next(error);
    }
};

export const handleGetMedicalAssignmentById = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const assignment = await getMedicalAssignmentById(tenantId, unitId, req.params.id);
        return success(res, assignment);
    } catch (error) {
        next(error);
    }
};

export const handleGetMedicalDashboard = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const dashboard = await getMedicalDashboard(tenantId, unitId);
        return success(res, dashboard);
    } catch (error) {
        next(error);
    }
};

export const handleGetMedicalStaff = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const staff = await getMedicalStaff(tenantId, unitId);
        return success(res, staff);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateMedicalAssignment = async (req, res, next) => {
    try {
        const data = updateMedicalAssignmentSchema.parse(req.body);
        const { tenantId, unitId } = getScope(req);
        const assignment = await updateMedicalAssignment(tenantId, unitId, req.params.id, data);
        return success(res, assignment, { message: 'Medical assignment updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateMedicalAssignmentStatus = async (req, res, next) => {
    try {
        const data = updateMedicalAssignmentStatusSchema.parse(req.body);
        const { tenantId, unitId } = getScope(req);
        const assignment = await updateMedicalAssignmentStatus(tenantId, unitId, req.params.id, data);
        return success(res, assignment, { message: 'Medical assignment status updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleDeleteMedicalAssignment = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const assignment = await deleteMedicalAssignment(tenantId, unitId, req.params.id);
        return success(res, assignment, { message: 'Medical assignment removed successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetDoctorVisits = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const { patientId, doctorId } = req.query;
        const visits = await getDoctorVisits(tenantId, unitId, { patientId, doctorId });
        return success(res, visits);
    } catch (error) {
        next(error);
    }
};

export const handleCreateDoctorVisit = async (req, res, next) => {
    try {
        const data = createDoctorVisitSchema.parse(req.body);
        const { tenantId, unitId } = getScope(req);
        const visit = await createDoctorVisit(tenantId, unitId, data);
        return success(res, visit, { message: 'Doctor visit created successfully' }, 201);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateDoctorVisit = async (req, res, next) => {
    try {
        const data = updateDoctorVisitSchema.parse(req.body);
        const { tenantId, unitId } = getScope(req);
        const visit = await updateDoctorVisit(tenantId, unitId, req.params.id, data);
        return success(res, visit, { message: 'Doctor visit updated successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetMyShift = async (req, res, next) => {
    try {
        const { tenantId, unitId } = getScope(req);
        const data = await getMyShift(tenantId, unitId, req.user);
        return success(res, data, { message: 'My shift retrieved successfully' });
    } catch (error) {
        next(error);
    }
};
