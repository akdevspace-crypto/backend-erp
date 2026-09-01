import { z } from 'zod';

export const contractDraftSchema = z.object({
    admissionId: z.string().uuid(),
    startDate: z.string().datetime(),
    endDate: z.string().datetime().nullable().optional(),
    staffRequired: z.number().int().positive().nullable().optional(),
    shift: z.string().nullable().optional(),
    frequency: z.string().nullable().optional(),
    careRequirements: z.any().nullable().optional(),
    specialInstructions: z.string().nullable().optional(),
    servicePrice: z.number().nonnegative().nullable().optional(),
    billingCycle: z.string().nullable().optional()
});

export const contractUpdateSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().nullable().optional(),
    staffRequired: z.number().int().positive().nullable().optional(),
    shift: z.string().nullable().optional(),
    frequency: z.string().nullable().optional(),
    careRequirements: z.any().nullable().optional(),
    specialInstructions: z.string().nullable().optional(),
    servicePrice: z.number().nonnegative().nullable().optional(),
    billingCycle: z.string().nullable().optional(),
    termsSnapshot: z.any().nullable().optional()
});
