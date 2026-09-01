import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
    userId?: string;
    tenantId?: string;
    unitId?: string;
    role?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runWithContext = <T>(context: RequestContext, callback: () => T): T => {
    return storage.run(context, callback);
};

export const getContext = (): RequestContext | undefined => {
    return storage.getStore();
};

export const requireContext = (): RequestContext => {
    const context = getContext();
    if (!context) {
        throw new Error('SYSTEM_ERROR: Request context is missing but required.');
    }
    return context;
};
