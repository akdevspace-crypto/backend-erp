import { z } from 'zod';

export const unitSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    code: z.string().min(2, "Code must be at least 2 characters").optional(),
    logoUrl: z.string().url("Must be a valid URL").optional().nullable(),
    shortName: z.string().optional().nullable(),
    unitType: z.string().optional().nullable(),
    locationId: z.string().uuid("Location is required"),
    address: z.string().optional().nullable(),
    pincode: z.string().optional().nullable(),
    email: z.string().email("Invalid email").optional().nullable(),
    phone: z.string().optional().nullable(),
    status: z.boolean().optional()
});
