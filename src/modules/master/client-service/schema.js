import { z } from 'zod';

export const clientServiceSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    category: z.string().min(2, "Category must be at least 2 characters"),
    price: z.number().positive("Price must be positive"),
    status: z.boolean().optional()
});
