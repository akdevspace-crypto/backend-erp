import { z } from 'zod';

export const vehicleEntrySchema = z.object({
    vehicleNo: z.string().trim().min(1, 'Vehicle number is required').transform(v => v.toUpperCase()),
    vehicleType: z.string().trim().optional().nullable(),
    driverName: z.string().trim().min(1, 'Driver name is required'),
    driverMobile: z.string().trim().optional().nullable(),
    companyName: z.string().trim().optional().nullable(),
    purpose: z.string().trim().min(1, 'Purpose is required'),
    materialDetails: z.string().trim().optional().nullable(),
    remarks: z.string().trim().optional().nullable()
});
