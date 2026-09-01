import { z } from 'zod';

export const roomSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    type: z.string().min(2, "Type must be at least 2 characters"),
    capacity: z.number().int().min(1, "Capacity must be at least 1"),
    status: z.boolean().optional()
});
