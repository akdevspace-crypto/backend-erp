import { z } from 'zod';

export const blogSchema = z.object({
    unitName: z.string().optional(),
    title: z.string().min(3),
    date: z.string().optional(),
    keywords: z.string().optional(),
    description: z.string().optional()
});
