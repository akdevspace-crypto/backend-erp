import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../app/prisma.js';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';

const router = Router();

const ambulanceEntityType = 'AMBULANCE_RECORD';

const ambulanceTypes = [
    'BOOKING',
    'DISPATCH',
    'FLEET',
    'STAFF_ASSIGNMENT',
    'TRIP_SHEET',
    'MAINTENANCE',
    'BILLING',
    'EMERGENCY_CALL'
] as const;

const createRecordSchema = z.object({
    type: z.enum(ambulanceTypes),
    status: z.string().min(1).optional(),
    data: z.record(z.string(), z.unknown()).optional().default({})
});

const updateStatusSchema = z.object({
    status: z.string().min(1)
});

const getScope = (req: any) => ({
    tenantId: req.user.tenantId,
    unitId: req.context?.unitId || req.user.unitId
});

const parseNotes = (notes?: string | null) => {
    if (!notes) return {};
    try {
        return JSON.parse(notes);
    } catch {
        return { remarks: notes };
    }
};

const getRecords = async (scope: { tenantId: string; unitId: string }, type?: string) => {
    const logs = await (prisma as any).workflowLog.findMany({
        where: {
            entityType: ambulanceEntityType,
            tenantId: scope.tenantId,
            unitId: scope.unitId,
            isDeleted: false
        },
        orderBy: { createdAt: 'desc' }
    });

    const latestByEntity = new Map<string, any>();
    for (const log of logs) {
        if (!latestByEntity.has(log.entityId)) {
            latestByEntity.set(log.entityId, log);
        }
    }

    return Array.from(latestByEntity.values())
        .map((log: any) => {
            const notes = parseNotes(log.notes);
            return {
                id: log.id,
                entityId: log.entityId,
                type: notes.type || 'BOOKING',
                status: log.toState,
                actionBy: log.actionBy,
                tenantId: log.tenantId,
                unitId: log.unitId,
                createdAt: log.createdAt,
                updatedAt: log.updatedAt,
                ...(notes.data || {})
            };
        })
        .filter((record: any) => !type || record.type === type);
};

router.get('/records', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const type = typeof req.query.type === 'string' ? req.query.type : undefined;
        const records = await getRecords(scope, type);
        res.json({ success: true, data: records });
    } catch (error: any) {
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

router.post('/records', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const validated = createRecordSchema.parse(req.body);
        const entityId = randomUUID();
        const status = validated.status || 'OPEN';

        await (prisma as any).workflowLog.create({
            data: {
                entityType: ambulanceEntityType,
                entityId,
                fromState: null,
                toState: status,
                actionBy: req.user.id || req.user.email || 'System',
                notes: JSON.stringify({
                    type: validated.type,
                    data: validated.data
                }),
                ...scope
            }
        });

        const records = await getRecords(scope, validated.type);
        const record = records.find((item: any) => item.entityId === entityId);
        res.status(201).json({ success: true, data: record, message: 'Ambulance record saved successfully' });
    } catch (error: any) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});

router.patch('/records/:entityId/status', auth, enforceTenant, async (req: any, res: any) => {
    try {
        const scope = getScope(req);
        const validated = updateStatusSchema.parse(req.body);
        const current = await (prisma as any).workflowLog.findFirst({
            where: {
                entityType: ambulanceEntityType,
                entityId: req.params.entityId,
                tenantId: scope.tenantId,
                unitId: scope.unitId,
                isDeleted: false
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!current) {
            return res.status(404).json({ success: false, message: 'Ambulance record not found' });
        }

        await (prisma as any).workflowLog.create({
            data: {
                entityType: ambulanceEntityType,
                entityId: req.params.entityId,
                fromState: current.toState,
                toState: validated.status,
                actionBy: req.user.id || req.user.email || 'System',
                notes: current.notes,
                ...scope
            }
        });

        const notes = parseNotes(current.notes);
        const records = await getRecords(scope, notes.type);
        const record = records.find((item: any) => item.entityId === req.params.entityId);
        res.json({ success: true, data: record, message: 'Ambulance status updated successfully' });
    } catch (error: any) {
        res.status(error.status || 400).json({ success: false, message: error.message });
    }
});

export default router;
