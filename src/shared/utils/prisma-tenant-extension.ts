import { getContext, RequestContext } from './context.js';
import { Prisma } from '../../generated/prisma/index.js';

export const tenantExtension = (prismaClient: any) => {
    return prismaClient.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }: any) {
                    const context = getContext();
                    if (!context) return query(args);

                    const { tenantId, unitId } = context;

                    // @ts-ignore - access internal DMMF safely
                    const modelMetadata = (Prisma as any).dmmf.datamodel.models.find((m: any) => m.name === model);
                    const hasTenantId = modelMetadata?.fields.some((f: any) => f.name === 'tenantId');
                    const hasUnitId = modelMetadata?.fields.some((f: any) => f.name === 'unitId');

                    if (!hasTenantId && !hasUnitId) return query(args);

                    const readOps = ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate', 'groupBy'];
                    const writeOps = ['update', 'delete', 'updateMany', 'deleteMany'];
                    const createOps = ['create', 'createMany'];

                    if (readOps.includes(operation) || writeOps.includes(operation)) {
                        args.where = args.where || {};
                        if (hasTenantId && tenantId && !args.where.tenantId) args.where.tenantId = tenantId;
                        if (hasUnitId && unitId && !args.where.unitId) args.where.unitId = unitId;

                        if (operation === 'findUnique') {
                            return prismaClient[model].findFirst(args);
                        }
                    }

                    if (createOps.includes(operation)) {
                        if (operation === 'create') {
                            args.data = args.data || {};
                            if (hasTenantId && tenantId && !args.data.tenantId) args.data.tenantId = tenantId;
                            if (hasUnitId && unitId && !args.data.unitId) args.data.unitId = unitId;
                        } else if (operation === 'createMany') {
                            const dataArray = Array.isArray(args.data) ? args.data : [args.data];
                            args.data = dataArray.map((item: any) => ({
                                ...item,
                                tenantId: hasTenantId && tenantId && !item.tenantId ? tenantId : item.tenantId,
                                unitId: hasUnitId && unitId && !item.unitId ? unitId : item.unitId
                            }));
                        }
                    }

                    if (operation === 'upsert') {
                        args.create = args.create || {};
                        args.where = args.where || {};
                        if (hasTenantId && tenantId) {
                            if (!args.create.tenantId) args.create.tenantId = tenantId;
                            if (!args.where.tenantId) args.where.tenantId = tenantId;
                        }
                        if (hasUnitId && unitId) {
                            if (!args.create.unitId) args.create.unitId = unitId;
                            if (!args.where.unitId) args.where.unitId = unitId;
                        }
                    }

                    return query(args);
                }
            }
        }
    });
};
