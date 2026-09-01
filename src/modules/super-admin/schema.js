import { z } from 'zod';

const booleanish = z.preprocess((value) => {
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
    }
    return value;
}, z.boolean());

export const createUserSchema = z.object({
    firstName: z.string().trim().min(2, 'First name is required'),
    lastName: z.string().trim().optional().or(z.literal('')),
    email: z.string().trim().email('Valid email is required'),
    mobile: z.string().trim().optional().or(z.literal('')),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    roleId: z.string().trim().min(1, 'Role is required'),
    unitId: z.string().trim().min(1, 'Unit is required'),
    isActive: booleanish.optional().default(true)
});

export const updateUserSchema = createUserSchema.omit({ password: true }).extend({
    password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal(''))
});
