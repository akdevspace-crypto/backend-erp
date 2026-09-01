import { z } from 'zod';

export const vendorSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    category: z.string().min(2, "Category must be at least 2 characters"),
    contact: z.string().optional().nullable(),
    status: z.boolean().optional()
});
