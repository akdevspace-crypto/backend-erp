import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
    console.error(err);
    const isProduction = process.env.NODE_ENV === 'production';

    if (err instanceof ZodError || err?.name === 'ZodError') {
        const issues = err?.issues || err?.errors || [];
        const errorMsg = issues.length > 0 ? issues.map(i => i.message).join(', ') : 'Validation failed';
        return res.status(400).json({
            success: false,
            message: errorMsg,
            code: 'VALIDATION_ERROR',
            errors: issues
        });
    }

    const prismaCode = typeof err?.code === 'string'
        ? err.code
        : (typeof err?.errorCode === 'string' ? err.errorCode : undefined);

    if (prismaCode === 'P1001') {
        return res.status(503).json({
            success: false,
            message: 'Database is temporarily unreachable. Please retry in a few seconds.',
            code: prismaCode
        });
    }

    if (prismaCode === 'P1008') {
        return res.status(504).json({
            success: false,
            message: 'Database request timed out. Please retry.',
            code: prismaCode
        });
    }

    if (prismaCode === 'P1011') {
        return res.status(503).json({
            success: false,
            message: 'Database TLS handshake failed. Verify DATABASE_URL SSL settings for your environment.',
            code: prismaCode
        });
    }

    if (prismaCode === 'P2002') {
        return res.status(409).json({
            success: false,
            message: 'A record with the same unique value already exists.',
            code: prismaCode
        });
    }

    if (prismaCode === 'P2025') {
        return res.status(404).json({
            success: false,
            message: 'Requested record was not found.',
            code: prismaCode
        });
    }

    if (prismaCode === 'P2003') {
        const target = err?.meta?.field_name || err?.meta?.target;
        return res.status(400).json({
            success: false,
            message: target ? `Database relation failed: ${target}` : 'Database relation failed.',
            code: prismaCode,
            details: err?.meta
        });
    }

    if (prismaCode === 'P2011') {
        const target = err?.meta?.constraint || err?.meta?.target;
        return res.status(400).json({
            success: false,
            message: target ? `Required database value missing: ${target}` : 'Required database value missing.',
            code: prismaCode,
            details: err?.meta
        });
    }

    if (prismaCode === 'P2022') {
        const modelName = err?.meta?.modelName;
        const column = err?.meta?.column;
        return res.status(500).json({
            success: false,
            message: `Database schema mismatch${column ? `: missing column ${column}` : ''}. Run the latest Prisma migration before retrying.`,
            code: prismaCode,
            details: {
                modelName,
                column
            }
        });
    }

    if (prismaCode === 'P2010') {
        const databaseMessage = err?.meta?.message;
        return res.status(400).json({
            success: false,
            message: databaseMessage || err.message || 'Database query failed.',
            code: prismaCode,
            details: err?.meta
        });
    }

    if (prismaCode === 'P2028') {
        return res.status(503).json({
            success: false,
            message: err?.meta?.error || err.message || 'Database transaction could not be started.',
            code: prismaCode,
            details: err?.meta
        });
    }

    if (err?.code === 'LOCATION_SYSTEM_NOT_READY') {
        return res.status(503).json({
            success: false,
            message: err.message,
            code: err.code
        });
    }

    // Prisma Error Handling (fallback for P2xxx)
    if (prismaCode && prismaCode.startsWith('P2')) {
        const target = err?.meta?.field_name || err?.meta?.target || err?.meta?.constraint || err?.meta?.modelName;
        const metaMessage = err?.meta?.message || err?.meta?.cause;
        return res.status(400).json({
            success: false,
            message: [
                `Database constraint failed (${prismaCode})`,
                target ? `target: ${Array.isArray(target) ? target.join(', ') : target}` : '',
                metaMessage ? `detail: ${metaMessage}` : ''
            ].filter(Boolean).join(' - '),
            code: prismaCode,
            details: err?.meta
        });
    }

    // Final catch-all to prevent server crash
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message: statusCode === 500 && isProduction ? "A critical system error occurred. Our engineers have been notified." : message,
        code: prismaCode || err.code || "INTERNAL_ERROR",
        errors: err?.issues || err?.errors,
        stack: isProduction ? undefined : err.stack
    });
};
