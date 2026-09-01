import { createEnquiry, listEnquiries, updateEnquiry, deleteEnquiry, addFollowUp, getEnquiry, listAdmissions, convertEnquiryToAdmission, recordRenewalFollowUpOutcome, createAdmissionClientPortalAccess, createExistingPatientAdmission, upsertEnquiryClientPortalAccess } from './service.js';
import { enquirySchema, followUpSchema, admissionConversionSchema, renewalFollowUpOutcomeSchema, admissionClientPortalAccessSchema, clientPortalAccessSchema, existingPatientSchema } from './schema.js';
import { success } from '../../shared/utils/response.js';
import { paginate } from '../../shared/utils/paginate.js';

const canReadAllUnits = (user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase();
    return ['admin', 'super admin', 'superadmin', 'customer relations manager'].includes(normalizedRole);
};

export const handleCreateEnquiry = async (req, res, next) => {
    try {
        const validatedData = enquirySchema.parse(req.body);
        const result = await createEnquiry(validatedData, req.user);

        return success(res, result, { message: 'Enquiry created successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleListEnquiries = async (req, res, next) => {
    try {
        const { page, limit, search, status, scope, unitId } = req.query;
        const pagination = paginate({ page, limit });
        const requestedAllUnits = scope === 'all';

        const result = await listEnquiries({
            ...pagination,
            search,
            status,
            unitId: requestedAllUnits && canReadAllUnits(req.user)
                ? 'ALL'
                : (unitId || req.unitId || req.user.unitId)
        }, req.user);

        return success(res, result.data, { total: result.count, message: 'Enquiries fetched successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleGetEnquiry = async (req, res, next) => {
    try {
        const result = await getEnquiry(req.params.id, req.user);
        if (!result) {
            const error = new Error('Enquiry not found');
            error.status = 404;
            throw error;
        }
        return success(res, result, { message: 'Enquiry fetched successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleUpdateEnquiry = async (req, res, next) => {
    try {
        const result = await updateEnquiry(req.params.id, req.body, req.user);
        return success(res, result, { message: 'Enquiry updated successfully' });
    } catch (error) { next(error); }
};

export const handleDeleteEnquiry = async (req, res, next) => {
    try {
        const result = await deleteEnquiry(req.params.id, req.user);
        return success(res, result, { message: 'Enquiry deleted successfully' });
    } catch (error) { next(error); }
};

export const handleAddFollowUp = async (req, res, next) => {
    try {
        const validatedData = followUpSchema.parse(req.body);
        const result = await addFollowUp(req.params.id, validatedData, req.user);
        return success(res, result, { message: 'Follow-up created successfully' });
    } catch (error) { next(error); }
};

export const handleRenewalFollowUpOutcome = async (req, res, next) => {
    try {
        const validatedData = renewalFollowUpOutcomeSchema.parse(req.body);
        const result = await recordRenewalFollowUpOutcome(req.params.id, validatedData, req.user);
        return success(res, result, {
            message: result.newEnquiry ? 'Renewal converted to a new enquiry' : 'Renewal outcome saved'
        });
    } catch (error) { next(error); }
};

export const handleListAdmissions = async (req, res, next) => {
    try {
        const { page, limit, search, status, scope, unitId } = req.query;
        const pagination = paginate({ page, limit });
        const requestedAllUnits = scope === 'all';
        const result = await listAdmissions({
            ...pagination,
            search,
            status,
            unitId: requestedAllUnits && canReadAllUnits(req.user)
                ? 'ALL'
                : (unitId || req.unitId || req.user.unitId)
        }, req.user);

        return success(res, result.data, { total: result.count, message: 'Admissions fetched successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleConvertEnquiryToAdmission = async (req, res, next) => {
    try {
        const validatedData = admissionConversionSchema.parse(req.body);
        const result = await convertEnquiryToAdmission(req.params.id, validatedData, req.user);

        return success(res, result, { message: 'Enquiry converted to admission successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateExistingPatientAdmission = async (req, res, next) => {
    try {
        const validatedData = existingPatientSchema.parse(req.body);
        const result = await createExistingPatientAdmission(validatedData, req.user);

        return success(res, result, { message: 'Existing patient added successfully' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateAdmissionClientPortalAccess = async (req, res, next) => {
    try {
        const validatedData = admissionClientPortalAccessSchema.parse(req.body);
        const result = await createAdmissionClientPortalAccess(req.params.admissionId, validatedData, req.user);

        return success(res, result, {
            message: result.alreadyExists ? 'Client portal login already exists' : 'Client portal login created'
        });
    } catch (error) {
        next(error);
    }
};

export const handleUpsertEnquiryClientPortalAccess = async (req, res, next) => {
    try {
        const validatedData = clientPortalAccessSchema.parse(req.body);
        const result = await upsertEnquiryClientPortalAccess(req.params.id, validatedData, req.user);

        return success(res, result, {
            message: result.created ? 'Client portal login created' : 'Client portal login updated'
        });
    } catch (error) {
        next(error);
    }
};
