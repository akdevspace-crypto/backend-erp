import { z } from 'zod';

export const citySchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    state: z.string().min(2, "State must be at least 2 characters"),
    country: z.string().min(2, "Country must be at least 2 characters"),
    status: z.boolean().optional()
});
