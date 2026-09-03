import { prisma } from '../../app/prisma.js';

const buildHttpError = (message, status = 400) => {
    const error = new Error(message);
    error.status = status;
    error.statusCode = status;
    return error;
};

export const checkoutVisitorPass = async ({ id, tenantId, unitId, req }) => {
    if (!id || !tenantId) {
        throw buildHttpError('Pass ID and Tenant ID are required', 400);
    }

    const existingPass = await prisma.visitorPass.findFirst({
        where: {
            id,
            tenantId,
            ...(unitId ? { unitId } : {})
        }
    });

    if (!existingPass) {
        // Return null if not found, let the caller handle 404 so it can fallback (like Security does for AuditLog)
        return null;
    }

    if (existingPass.checkOutAt) {
        throw buildHttpError('Visitor is already checked out', 400);
    }

    const updatedPass = await prisma.visitorPass.update({
        where: { id },
        data: {
            checkOutAt: new Date().toISOString()
        }
    });

    return updatedPass;
};
