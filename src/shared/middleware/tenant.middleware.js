export const enforceTenant = (req, res, next) => {
    // Enforce that the user's tenantId is applied to the request query or body
    // to prevent cross-tenant data access.

    if (!req.user || !req.user.tenantId) {
        return res.status(401).json({ success: false, message: 'Tenant identifier missing in authentication' });
    }

    // We attach tenantId and unitId to the req object for controllers/services to use easily
    req.tenantId = req.context?.tenantId || req.user.tenantId;
    req.unitId = req.context?.unitId || req.user.unitId;

    // Keep existing services/controllers that read req.user in sync with the
    // active entity selected through x-unit-id.
    req.user.tenantId = req.tenantId;
    req.user.unitId = req.unitId;

    next();
};
