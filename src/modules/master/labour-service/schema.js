import { z } from 'zod';

export const labourServiceSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    type: z.string().min(2, "Type must be at least 2 characters"),
    rate: z.number().positive("Rate must be positive"),
    agency: z.string().optional().nullable(),
    status: z.boolean().optional()
});
