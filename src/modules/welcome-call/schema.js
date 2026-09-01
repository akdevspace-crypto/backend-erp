import { z } from 'zod';

export const welcomeCallSchema = z.object({
    clientId: z.string().uuid("Client ID is required"),
    status: z.enum(['PENDING', 'COMPLETED']).default('PENDING'),
    notes: z.string().optional(),
    callDate: z.string().datetime().optional()
});

export const updateWelcomeCallSchema = z.object({
    status: z.enum(['PENDING', 'COMPLETED']).optional(),
    notes: z.string().optional(),
    callDate: z.string().datetime().optional()
});
