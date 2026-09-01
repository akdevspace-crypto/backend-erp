import { Worker, Job } from "bullmq";
import axios from "axios";
import nodemailer from "nodemailer";
// @ts-ignore
import { prisma } from "../app/prisma.js";
// @ts-ignore
import { ConversationService } from "../intelligence/services/conversation.service.js";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function resolveTemplate(templateName: string, tenantId: string, unitId: string, variables: any) {
    const template = await prisma.messageTemplate.findFirst({
        where: { name: templateName, tenantId, unitId, status: "ACTIVE" }
    });
    if (!template) return null;
    let content = template.content;
    if (variables) {
        for (const [key, value] of Object.entries(variables)) {
            content = content.replace(new RegExp(`{{${key}}}`, "g"), value as string);
        }
    }
    return { content, subject: template.subject };
}

async function sendWhatsApp(data: any) {
    const { phone, message, templateName, variables, tenantId, unitId, entityId, entityType, clientId, enquiryId } = data;

    let finalMessage = message;
    let resolvedTemplate = null;

    if (templateName) {
        resolvedTemplate = await resolveTemplate(templateName, tenantId, unitId, variables);
        if (resolvedTemplate) {
            finalMessage = resolvedTemplate.content;
        }
    }

    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: phone,
                type: "text",
                text: { body: finalMessage }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ WhatsApp sent:", phone);

        // Log to Unified Conversation System
        await ConversationService.appendMessage({
            tenantId,
            unitId,
            entityType,
            entityId,
            clientId,
            enquiryId,
            channel: "whatsapp",
            direction: "OUTBOUND",
            body: finalMessage,
            recipient: phone,
            status: "SENT",
            templateName,
            rawPayload: { status: "sent", phone }
        });

    } catch (error: any) {
        console.error("❌ WhatsApp failed:", phone, error.response?.data || error.message);
        throw error;
    }
}

async function sendEmail(data: any) {
    const { to, subject, text, templateName, variables, tenantId, unitId, entityId, entityType, clientId, enquiryId } = data;

    let finalText = text;
    let finalSubject = subject;

    if (templateName) {
        const resolved = await resolveTemplate(templateName, tenantId, unitId, variables);
        if (resolved) {
            finalText = resolved.content;
            finalSubject = resolved.subject || subject;
        }
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject: finalSubject,
            text: finalText
        });

        console.log("✅ Email sent:", to);

        // Log to Unified Conversation System
        await ConversationService.appendMessage({
            tenantId,
            unitId,
            entityType,
            entityId,
            clientId,
            enquiryId,
            channel: "email",
            direction: "OUTBOUND",
            body: finalText,
            recipient: to,
            status: "SENT",
            templateName,
            metadata: { subject: finalSubject },
            rawPayload: { status: "sent", to, subject: finalSubject }
        });

    } catch (error: any) {
        console.error("❌ Email failed:", to, error.message);
        throw error;
    }
}

import { getOmnichannelEnv } from "../config/omnichannel.js";
import { getOutboundQueueConnection } from "./outbound.queue.js";
import { logger } from "../shared/services/logger.js";
import { getEmitter, getIO, initEmitter } from "../shared/services/socket.js";
import { processOutboundMessageJob } from "./outbound.processor.js";
import { runWithContext } from "../shared/utils/context.js";

const env = getOmnichannelEnv();
const workerLogger = logger.child({ scope: "outbound-worker" });

let outboundWorker: Worker | null = null;
let emitterInitPromise: Promise<unknown> | null = null;

const ensureEmitter = async () => {
    if (getIO() || getEmitter()) return;
    if (!emitterInitPromise) {
        emitterInitPromise = initEmitter().catch((error: unknown) => {
            workerLogger.warn("Socket emitter initialization failed for outbound worker", { error });
            emitterInitPromise = null;
        });
    }
    await emitterInitPromise;
};

const processJob = async (job: Job) => {
    const context = {
        tenantId: job.data.tenantId,
        unitId: job.data.unitId,
        userId: job.data.userId || null
    };

    return runWithContext(context, async () => processOutboundMessageJob(job));
};

export const createOutboundWorker = () => {
    if (outboundWorker) return outboundWorker;

    outboundWorker = new Worker("outbound", processJob, {
        connection: getOutboundQueueConnection(),
        concurrency: env.OUTBOUND_CONCURRENCY,
        limiter: {
            max: env.OUTBOUND_RATE_LIMIT_MAX,
            duration: env.OUTBOUND_RATE_LIMIT_DURATION_MS
        }
    });

    outboundWorker.on("active", (job) => {
        workerLogger.info("Outbound job started", {
            jobId: job.id,
            messageId: job.data?.messageId,
            conversationId: job.data?.conversationId,
            channel: job.data?.channel,
            tenantId: job.data?.tenantId,
            unitId: job.data?.unitId
        });
    });

    outboundWorker.on("completed", (job, result) => {
        workerLogger.info("Outbound job completed", {
            jobId: job.id,
            messageId: job.data?.messageId,
            conversationId: job.data?.conversationId,
            channel: job.data?.channel,
            tenantId: job.data?.tenantId,
            unitId: job.data?.unitId,
            status: result?.status || "COMPLETED"
        });
    });

    outboundWorker.on("failed", (job, error) => {
        workerLogger.error("Outbound job failed", {
            jobId: job?.id,
            messageId: job?.data?.messageId,
            conversationId: job?.data?.conversationId,
            channel: job?.data?.channel,
            tenantId: job?.data?.tenantId,
            unitId: job?.data?.unitId,
            error
        });
    });

    outboundWorker.on("error", (error) => {
        workerLogger.error("Outbound worker error", { error });
    });

    return outboundWorker;
};

export const startOutboundWorker = async () => {
    await ensureEmitter();
    const worker = createOutboundWorker();
    await worker.waitUntilReady();

    workerLogger.info("Outbound worker ready", {
        concurrency: env.OUTBOUND_CONCURRENCY,
        rateLimitMax: env.OUTBOUND_RATE_LIMIT_MAX,
        rateLimitDurationMs: env.OUTBOUND_RATE_LIMIT_DURATION_MS
    });

    return worker;
};

export const stopOutboundWorker = async () => {
    if (!outboundWorker) return;

    await outboundWorker.close();
    workerLogger.info("Outbound worker stopped");
    outboundWorker = null;
};
