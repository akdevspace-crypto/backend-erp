import { z } from 'zod';

export const allocationSchema = z.object({
    enquiryId: z.string().uuid("Enquiry ID is required"),
    targetUnitId: z.string().uuid("Target unit ID is required").optional(),
    staffId: z.string().uuid("Staff ID is required").nullable().optional(),
    type: z.enum(['HOME_CARE', 'CLINICAL', 'IN_HOUSE', 'OTHERS']).default('HOME_CARE'),
    startDate: z.string(),
    endDate: z.string().optional(),
    status: z.enum(['PENDING', 'ALLOCATED', 'ON_HOLD', 'COMPLETED']).optional(),
    metadata: z.record(z.string(), z.any()).optional()
});
