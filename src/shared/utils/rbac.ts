export const canReadFacilityWide = (user: any): boolean => {
    if (!user) return false;

    // Existing legitimate facility-wide authorization logic from original canReadAllUnits implementations
    const existingFacilityWideAllowed = Boolean(
        user?.unitAccess?.includes('*') ||
        user?.permissions?.includes('ALL_ACCESS')
    );

    if (existingFacilityWideAllowed) {
        return true;
    }

    const roleName = String(user?.role || user?.roleName || '').trim().toLowerCase();

    // Specific inclusion of modern manager roles
    const managerRoles = [
        'nursing_manager',
        'patient_care_manager',
        // Legacy roles that originally had this access
        'admin',
        'super admin',
        'super_admin',
        'superadmin',
        'in-house care manager',
        'healthcare manager'
    ];

    return managerRoles.includes(roleName);
};

export const getReadScope = (req: any) => {
    if (!req.user || !req.user.tenantId) {
        throw new Error("getReadScope: tenantId is strictly required but was not found on req.user");
    }

    const includeAllUnits = String(req.query?.scope || '').trim().toLowerCase() === 'all' && canReadFacilityWide(req.user);
    
    return {
        tenantId: req.user.tenantId,
        ...(includeAllUnits ? {} : { unitId: req.context?.unitId || req.user.unitId })
    };
};
