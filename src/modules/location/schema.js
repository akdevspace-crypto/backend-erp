import { z } from 'zod';

const normalizeText = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
};

export const locationSearchSchema = z.object({
    q: z.preprocess(normalizeText, z.string().min(1).max(100).default(''))
});

export const createLocationSchema = z.object({
    name: z.preprocess(normalizeText, z.string().min(2, 'City name is required')),
    state: z.preprocess(normalizeText, z.string().min(2, 'State is required')),
    country: z.preprocess(normalizeText, z.string().min(2, 'Country is required')),
    pincode: z.preprocess(normalizeText, z.string().min(3).max(20).optional())
});
