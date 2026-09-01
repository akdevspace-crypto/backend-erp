import { prisma } from '../../app/prisma.js';
import { getContext } from '../../shared/utils/context.js';
import { canReadFacilityWide } from '../../shared/utils/rbac.js';

export const getAuditLogs = async (req, res, next) => {
    try {
        const { tenantId, unitId, role } = req.user;
        const context = getContext();
        const finalUnitId = context?.unitId || unitId;
        
        const { module, userId, startDate, endDate, limit = 50, page = 1 } = req.query;
        
        const isSuperAdmin = canReadFacilityWide(req.user);

        const where = {
            tenantId,
            isDeleted: false,
        };

        if (!isSuperAdmin) {
            where.unitId = finalUnitId;
        }

        if (module) {
            where.module = module;
        }

        if (userId) {
            where.userId = userId;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

        const [totalCount, logs] = await Promise.all([
            prisma.auditLog.count({ where }),
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: { select: { name: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: Number(limit),
                skip
            })
        ]);

        res.json({
            success: true,
            data: logs,
            pagination: {
                total: totalCount,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(totalCount / Number(limit))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
