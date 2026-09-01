import { logAudit } from '../../modules/audit/service.js';

export const auditLogger = async (req, res, next) => {
    // Store original send function
    const originalSend = res.send;

    // Override to capture right before request completes
    res.send = function (data) {
        // Restore original functionality to avoid max call stack errors
        res.send = originalSend;

        // Log successful mutations (POST, PUT, PATCH, DELETE)
        if (req.method !== 'GET' && res.statusCode >= 200 && res.statusCode < 400) {
            const userId = req.user?.id || req.user?.userId;
            const tenantId = req.user?.tenantId;
            const unitId = req.user?.unitId;

            // 🛡️ Safe Guard: IF missing context/ids → skip log, do not crash
            if (userId && tenantId && unitId) {
                try {
                    logAudit({
                        userId,
                        module: req.baseUrl || req.path,
                        action: req.method,
                        payload: req.body,
                        tenantId,
                        unitId
                    }).catch((err) => console.error('Failed to log audit:', err));
                } catch (err) {
                    console.error('Audit Logger Execution Error (Prevented Crash):', err);
                }
            }
        }

        // Send data
        return res.send(data);
    };

    next();
};
