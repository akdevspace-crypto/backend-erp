import { z } from 'zod';

export const departmentSchema = z.object({
    code: z.string().min(2, "Code must be at least 2 characters"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    head: z.string().optional().nullable(),
    totalStaff: z.number().min(0).optional(),
    status: z.boolean().optional()
});
