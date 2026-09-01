import { z } from 'zod';

export const complaintSchema = z.object({
    title: z.string().optional(),
    clientName: z.string().optional(),
    unitId: z.string().optional(),
    tenantId: z.string().optional(),
    category: z.string().optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Low'),
    description: z.string().min(5, "Description is required"),
    assignedTo: z.string().optional(),
    status: z.enum(['Open', 'In Progress', 'Resolved']).default('Open'),
    attachmentUrl: z.string().optional()
});
