import { z } from 'zod';

export const paymentCategorySchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().optional().nullable(),
    status: z.boolean().optional()
});
