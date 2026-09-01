import type { Request, Response, NextFunction } from 'express';
import { runWithContext, RequestContext } from '../utils/context.js';

export const contextMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    const context: RequestContext = {
        userId: user?.id,
        tenantId: user?.tenantId,
        unitId: ((req.headers['x-unit-id'] as string) || user?.unitId),
        role: user?.role
    };

    runWithContext(context, () => {
        next();
    });
};
