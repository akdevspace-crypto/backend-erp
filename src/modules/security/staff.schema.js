import { z } from 'zod';

export const staffEntrySchema = z.object({
    staffId: z.string().uuid('Invalid Staff ID')
});

export const tempExitSchema = z.object({
    reason: z.string().min(1, 'Reason is required'),
    expectedReturnAt: z.string().datetime().optional().nullable(),
    companionType: z.string().optional().nullable(),
    companionStaffId: z.string().uuid().optional().nullable(),
    companionVisitorProfileId: z.string().uuid().optional().nullable(),
    companionName: z.string().optional().nullable(),
    companionPhone: z.string().optional().nullable(),
    companionRelation: z.string().optional().nullable(),
    materials: z.any().optional().nullable()
});

export const returnSchema = z.object({
    tripId: z.string().uuid('Invalid Trip ID')
});
