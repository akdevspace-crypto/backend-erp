import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const positiveInteger = (fallback) =>
    z.coerce.number().int().positive().catch(fallback);

const booleanFlag = (fallback = false) => z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
        if (typeof value === "boolean") return value;
        if (value === undefined || value === null || value === "") {
            return fallback;
        }

        return String(value).trim().toLowerCase() === "true";
    });

const inlineWorkerFlag = z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((value) => {
        if (typeof value === "boolean") return value;
        return String(value || "false").trim().toLowerCase() === "true";
    });

const runtimeSettingsSchema = z.object({
    OUTBOUND_WORKER_INLINE: inlineWorkerFlag
});

const outboundQueueSchema = z.object({
    REDIS_URL: z.string().trim().min(1, "REDIS_URL is required"),
    OUTBOUND_QUEUE_ATTEMPTS: positiveInteger(5),
    OUTBOUND_QUEUE_BACKOFF_MS: positiveInteger(5000),
    OUTBOUND_REMOVE_ON_COMPLETE_COUNT: positiveInteger(1000),
    OUTBOUND_REMOVE_ON_FAIL_COUNT: positiveInteger(1000)
});

const outboundWorkerSchema = outboundQueueSchema.extend({
    OUTBOUND_RATE_LIMIT_MAX: positiveInteger(10),
    OUTBOUND_RATE_LIMIT_DURATION_MS: positiveInteger(1000),
    OUTBOUND_CONCURRENCY: positiveInteger(1)
});

const whatsappChannelSchema = z.object({
    WHATSAPP_PHONE_ID: z.string().trim().min(1, "WHATSAPP_PHONE_ID is required"),
    WHATSAPP_TOKEN: z.string().trim().min(1, "WHATSAPP_TOKEN is required"),
    WHATSAPP_API_VERSION: z.string().trim().min(1).catch("v18.0")
});

const emailChannelSchema = z.object({
    EMAIL_USER: z.string().trim().min(1, "EMAIL_USER is required"),
    EMAIL_PASS: z.string().trim().min(1, "EMAIL_PASS is required"),
    EMAIL_FROM: z.string().trim().optional(),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: positiveInteger(587),
    SMTP_SECURE: booleanFlag(false)
});

const emailInboundSchema = z.object({
    EMAIL_USER: z.string().trim().min(1, "EMAIL_USER is required"),
    EMAIL_PASS: z.string().trim().min(1, "EMAIL_PASS is required"),
    IMAP_HOST: z.string().trim().catch("imap.gmail.com"),
    IMAP_PORT: positiveInteger(993),
    IMAP_TLS: booleanFlag(true)
});

const whatsappWebhookSchema = z.object({
    WHATSAPP_PHONE_ID: z.string().trim().min(1, "WHATSAPP_PHONE_ID is required"),
    WHATSAPP_VERIFY_TOKEN: z.string().trim().min(1, "WHATSAPP_VERIFY_TOKEN is required"),
    WHATSAPP_APP_SECRET: z.string().trim().min(1, "WHATSAPP_APP_SECRET is required")
});

const emailWebhookSchema = z.object({
    EMAIL_USER: z.string().trim().min(1, "EMAIL_USER is required")
});

const exotelSchema = z.object({
    EXOTEL_API_KEY: z.string().trim().min(1, "EXOTEL_API_KEY is required"),
    EXOTEL_API_TOKEN: z.string().trim().min(1, "EXOTEL_API_TOKEN is required"),
    EXOTEL_SID: z.string().trim().min(1, "EXOTEL_SID is required"),
    EXOTEL_SUBDOMAIN: z.string().trim().min(1).catch("api.exotel.com"),
    EXOTEL_CALLER_ID: z.string().trim().min(1, "EXOTEL_CALLER_ID is required"),
    EXOTEL_STATUS_CALLBACK_URL: z.string().trim().optional(),
    EXOTEL_INBOUND_RESPONSE_MESSAGE: z.string().trim().optional(),
    EXOTEL_CALL_TIMEOUT: positiveInteger(45),
    EXOTEL_CALL_TIMELIMIT: positiveInteger(900)
});

const twilioSchema = z.object({
    TWILIO_ACCOUNT_SID: z.string().trim().min(1, "TWILIO_ACCOUNT_SID is required"),
    TWILIO_AUTH_TOKEN: z.string().trim().min(1, "TWILIO_AUTH_TOKEN is required"),
    TWILIO_PHONE_NUMBER: z.string().trim().min(1, "TWILIO_PHONE_NUMBER is required")
});

const omnichannelSchema = runtimeSettingsSchema
    .merge(outboundWorkerSchema)
    .merge(whatsappChannelSchema)
    .merge(emailChannelSchema)
    .merge(whatsappWebhookSchema);

const cachedEnv = new Map();

const flattenIssues = (issues) => issues.map((issue) => {
    const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
});

const parseEnv = (cacheKey, schema, label) => {
    if (cachedEnv.has(cacheKey)) {
        return cachedEnv.get(cacheKey);
    }

    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
        const details = flattenIssues(parsed.error.issues).join("; ");
        throw new Error(`${label} validation failed: ${details}`);
    }

    cachedEnv.set(cacheKey, parsed.data);
    return parsed.data;
};

export const getOmnichannelRuntimeSettings = () =>
    parseEnv("runtime-settings", runtimeSettingsSchema, "Omnichannel runtime environment");

export const getOutboundQueueEnv = () =>
    parseEnv("outbound-queue", outboundQueueSchema, "Outbound queue environment");

export const getOutboundWorkerEnv = () =>
    parseEnv("outbound-worker", outboundWorkerSchema, "Outbound worker environment");

export const getWhatsAppChannelEnv = () =>
    parseEnv("whatsapp-channel", whatsappChannelSchema, "WhatsApp outbound environment");

export const getEmailChannelEnv = () =>
    parseEnv("email-channel", emailChannelSchema, "Email outbound environment");

export const getEmailInboundEnv = () =>
    parseEnv("email-inbound", emailInboundSchema, "Email inbound environment");

export const getWhatsAppWebhookEnv = () =>
    parseEnv("whatsapp-webhook", whatsappWebhookSchema, "WhatsApp webhook environment");

export const getEmailWebhookEnv = () =>
    parseEnv("email-webhook", emailWebhookSchema, "Email webhook environment");

export const getExotelEnv = () =>
    parseEnv("exotel", exotelSchema, "Exotel environment");

export const getTwilioEnv = () =>
    parseEnv("twilio", twilioSchema, "Twilio SMS environment");

export const getOmnichannelEnv = () =>
    parseEnv("omnichannel", omnichannelSchema, "Omnichannel environment");

export const validateOmnichannelEnv = () => getOmnichannelEnv();
export const validateOutboundWorkerEnv = () => getOutboundWorkerEnv();
