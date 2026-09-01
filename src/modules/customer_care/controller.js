import { createComplaint, createRenewalFollowUp, getComplaints, getPendingFeedbackServices, getServiceHistory, recordServiceFeedback, updateComplaintWorkflow } from './service.js';
import { success } from '../../shared/utils/response.js';
import { complaintSchema } from './schema.js';

const normalizePriority = (p) => {
    const map = {
        low: "Low",
        medium: "Medium",
        high: "High",
        critical: "Critical"
    };
    return map[p?.toLowerCase()] || "Low";
};

const normalizeStatus = (s) => {
    const map = {
        new: "Open",
        open: "Open",
        progress: "In Progress",
        resolved: "Resolved"
    };
    return map[s?.toLowerCase()] || "Open";
};

const canReadAllUnits = (user) => {
    const normalizedRole = String(user?.role || '').trim().toLowerCase().replace(/_/g, ' ');
    return ['admin', 'super admin', 'superadmin', 'customer relations manager'].includes(normalizedRole);
};

export const handleCreateComplaint = async (req, res, next) => {
    try {
        console.log("📥 Incoming Request:", req.body);
        console.log("🧠 Context:", req.context);

        const rawData = {
            ...req.body,
            tenantId: req.context?.tenantId || req.user?.tenantId,
            unitId: req.context?.unitId || req.user?.unitId,
            attachmentUrl: req.file ? `/uploads/${req.file.filename}` : undefined
        };

        rawData.priority = normalizePriority(rawData.priority);
        rawData.status = normalizeStatus(rawData.status);

        const data = complaintSchema.parse(rawData);

        console.log("✅ Validation passed");
        const issue = await createComplaint(data.tenantId, data);
        console.log("💾 Complaint created");

        return success(res, issue, { message: 'Complaint successfully logged' });
    } catch (error) {
        next(error);
    }
};

export const handleGetComplaints = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const complaints = await getComplaints(req.user.tenantId, requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId);
        return success(res, complaints);
    } catch (error) {
        next(error);
    }
};

export const handleUpdateComplaintWorkflow = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const complaint = await updateComplaintWorkflow(
            req.user.tenantId,
            requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId,
            req.user.id,
            req.params.complaintId,
            req.body
        );

        return success(res, complaint, { message: 'Complaint workflow updated' });
    } catch (error) {
        next(error);
    }
};

export const handleComplaintAnalysis = async (req, res, next) => {
    try {
        const complaints = await getComplaints(req.user.tenantId, req.user.unitId);
        const summary = {
            total: complaints.length,
            open: complaints.filter((item) => item.status === 'OPEN').length,
            resolved: complaints.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED').length,
            highPriority: complaints.filter((item) => ['HIGH', 'CRITICAL'].includes(String(item.priority || '').toUpperCase())).length,
            byType: complaints.reduce((acc, item) => {
                const key = item.type || 'general';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {}),
            byUrgency: complaints.reduce((acc, item) => {
                const key = item.urgency || 'UNKNOWN';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {})
        };

        return success(res, summary);
    } catch (error) {
        next(error);
    }
};

export const handleGetServiceHistory = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const history = await getServiceHistory(req.user.tenantId, requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId);
        return success(res, history);
    } catch (error) {
        next(error);
    }
};

export const handleGetPendingFeedback = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const records = await getPendingFeedbackServices(req.user.tenantId, requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId);
        return success(res, records);
    } catch (error) {
        next(error);
    }
};

export const handleRecordServiceFeedback = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const result = await recordServiceFeedback(
            req.user.tenantId,
            requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId,
            req.user.id,
            req.params.allocationId,
            req.body
        );
        return success(res, result, { message: 'Customer feedback recorded and service closed' });
    } catch (error) {
        next(error);
    }
};

export const handleCreateRenewalFollowUp = async (req, res, next) => {
    try {
        const requestedAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all';
        const result = await createRenewalFollowUp(
            req.user.tenantId,
            requestedAllUnits && canReadAllUnits(req.user) ? 'ALL' : req.user.unitId,
            req.user.id,
            req.params.allocationId,
            req.body
        );

        return success(res, result, {
            message: result.alreadyExists ? 'Renewal follow-up already exists' : 'Renewal follow-up created'
        });
    } catch (error) {
        next(error);
    }
};
