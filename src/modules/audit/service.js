import { prisma } from '../../app/prisma.js';
import { getContext } from '../../shared/utils/context.js';

export const logAudit = async ({ userId, module, action, payload, tenantId, unitId }) => {
    const context = getContext();

    // Use context values if passed values are missing
    const finalUserId = userId || context?.userId;
    const finalTenantId = tenantId || context?.tenantId;
    const finalUnitId = unitId || context?.unitId;

    // 🛡️ Safe Guard: IF missing critical IDs during bg task → skip log
    if (!finalUserId || !finalTenantId) {
        console.warn(`[Audit] Skipping log: Missing identification (User:${finalUserId}, Tenant:${finalTenantId})`);
        return;
    }

    try {
        return await prisma.auditLog.create({
            data: {
                userId: finalUserId,
                module,
                action,
                payload: payload ? JSON.parse(JSON.stringify(payload)) : null,
                tenantId: finalTenantId,
                unitId: finalUnitId
            }
        });
    } catch (err) {
        console.error('CRITICAL DATABASE ERROR during Audit Log:', err.message);
        // Do not throw! Audit log failure should not crash the transaction/request.
    }
};
