import { z } from 'zod';

export const vitalSignSchema = z.object({
    patientId: z.string().uuid("Patient ID is required"),
    bp: z.string().optional(),
    pulse: z.number().int().optional(),
    temp: z.number().optional(),
    spO2: z.number().int().optional(),
    notes: z.string().optional()
});

export const updateVitalSignSchema = z.object({
    bp: z.string().optional(),
    pulse: z.number().int().optional(),
    temp: z.number().optional(),
    spO2: z.number().int().optional(),
    notes: z.string().optional()
});
