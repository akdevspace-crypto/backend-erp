import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

let cachedEnv = null;

const booleanFromEnv = (value, fallback = false) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return String(value).trim().toLowerCase() === "true";
};

const integerFromEnv = (value, fallback) => {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const messagingEnvSchema = z.object({
    REDIS_URL: z.string().trim().min(1, "REDIS_URL is required"),
    WHATSAPP_PHONE_ID: z.string().trim().min(1, "WHATSAPP_PHONE_ID is required"),
    WHATSAPP_TOKEN: z.string().trim().min(1, "WHATSAPP_TOKEN is required"),
    WHATSAPP_VERIFY_TOKEN: z.string().trim().min(1, "WHATSAPP_VERIFY_TOKEN is required"),
    WHATSAPP_APP_SECRET: z.string().trim().min(1, "WHATSAPP_APP_SECRET is required"),
    EMAIL_USER: z.string().trim().min(1, "EMAIL_USER is required"),
    EMAIL_PASS: z.string().trim().min(1, "EMAIL_PASS is required"),
    EMAIL_FROM: z.string().trim().optional().nullable(),
    SMTP_HOST: z.string().trim().optional().nullable(),
    SMTP_PORT: z.number().int().positive().default(587),
    SMTP_SECURE: z.boolean().default(false),
    WHATSAPP_RATE_LIMIT_MAX: z.number().int().positive().default(10),
    WHATSAPP_RATE_LIMIT_WINDOW_MS: z.number().int().positive().default(1000),
    OUTBOUND_WORKER_INLINE: z.boolean().default(false),
    WHATSAPP_API_VERSION: z.string().trim().min(1).default("v18.0")
});

export const getMessagingEnv = () => {
    if (cachedEnv) {
        return cachedEnv;
    }

    const parsed = messagingEnvSchema.safeParse({
        REDIS_URL: process.env.REDIS_URL,
        WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
        WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
        WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
        WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
        EMAIL_USER: process.env.EMAIL_USER,
        EMAIL_PASS: process.env.EMAIL_PASS,
        EMAIL_FROM: process.env.EMAIL_FROM,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: integerFromEnv(process.env.SMTP_PORT, 587),
        SMTP_SECURE: booleanFromEnv(process.env.SMTP_SECURE, false),
        WHATSAPP_RATE_LIMIT_MAX: integerFromEnv(process.env.WHATSAPP_RATE_LIMIT_MAX, 10),
        WHATSAPP_RATE_LIMIT_WINDOW_MS: integerFromEnv(process.env.WHATSAPP_RATE_LIMIT_WINDOW_MS, 1000),
        OUTBOUND_WORKER_INLINE: booleanFromEnv(process.env.OUTBOUND_WORKER_INLINE, false),
        WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || "v18.0"
    });

    if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => issue.message).join("; ");
        throw new Error(`Messaging environment validation failed: ${issues}`);
    }

    cachedEnv = parsed.data;
    return cachedEnv;
};

export const validateMessagingEnvironment = () => getMessagingEnv();

export const shouldStartInlineOutboundWorker = () => getMessagingEnv().OUTBOUND_WORKER_INLINE;
