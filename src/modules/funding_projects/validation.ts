import { z } from 'zod';

export const createFundingCategorySchema = z.object({
    name: z.string().min(1),
    description: z.string().optional()
});

export const createProjectClassificationSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional()
});

export const createProjectSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    classificationId: z.string().optional(),
    totalBudget: z.number().min(0),
    startDate: z.string().optional(),
    endDate: z.string().optional()
});

export const createFundingAllocationSchema = z.object({
    projectId: z.string().min(1),
    amount: z.number().min(0),
    source: z.string().optional(),
    notes: z.string().optional()
});

export const createProjectExpenditureSchema = z.object({
    projectId: z.string().min(1),
    amount: z.number().min(0),
    description: z.string().optional(),
    category: z.string().optional()
});

export const approveExpenditureSchema = z.object({
    status: z.enum(['APPROVED', 'REJECTED'])
});
