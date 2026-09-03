import { z } from 'zod';

export const createOutingRequestSchema = z.object({
    patientId: z.string().uuid("Valid Patient ID is required"),
    reason: z.string().optional(),
    destination: z.string().optional(),
    expectedExitAt: z.string().datetime("Valid ISO datetime required for expectedExitAt"),
    expectedReturnAt: z.string().datetime("Valid ISO datetime required for expectedReturnAt"),
    
    companionType: z.enum(['STAFF', 'VISITOR', 'EXTERNAL']).optional(),
    companionStaffId: z.string().uuid().optional(),
    companionVisitorProfileId: z.string().uuid().optional(),
    companionName: z.string().optional(),
    companionPhone: z.string().optional(),
    companionRelation: z.string().optional(),
    
    materials: z.array(z.string()).optional()
}).refine(data => {
    return new Date(data.expectedReturnAt) > new Date(data.expectedExitAt);
}, {
    message: "expectedReturnAt must be after expectedExitAt",
    path: ["expectedReturnAt"]
});

export const processApprovalSchema = z.object({
    action: z.enum(['APPROVED', 'REJECTED']),
    comments: z.string().optional()
});
