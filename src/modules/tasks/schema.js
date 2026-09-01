import { z } from 'zod';

export const taskSchema = z.object({
    title: z.string().min(3),
    description: z.string().optional(),
    assigneeId: z.string(),
    approvalAuthorityId: z.string().optional(),
    type: z.enum(['DAILY', 'SCHEDULED']).default('DAILY'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    dueDate: z.string().optional()
});

export const updateTaskStatusSchema = z.object({
    status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']),
    completedAt: z.string().optional().nullable(),
    remarks: z.string().optional().nullable()
});
