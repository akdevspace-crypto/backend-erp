import { prisma } from "../app/prisma.js";
import { ConversationService } from "../intelligence/services/conversation.service.js";
import { sendToChannel } from "../services/channelRouter.js";
import { logger } from "../shared/services/logger.js";

const loggerWithScope = logger.child({ scope: "outbound-processor" });

export class NonRetryableOutboundJobError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "NonRetryableOutboundJobError";
        this.details = details;
    }
}

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();

const buildLogContext = (payload, extra = {}) => ({
    channel: payload.channel,
    externalUserId: payload.externalUserId,
    conversationId: payload.conversationId,
    messageId: payload.messageId,
    tenantId: payload.tenantId,
    unitId: payload.unitId,
    ...extra
});

const getMessageLookup = async ({ messageId, tenantId, unitId }) => prisma.message.findFirst({
    where: {
        id: messageId,
        tenantId,
        ...(unitId && unitId !== "ALL" ? { unitId } : {})
    }
});

const terminalStatuses = new Set(["SENT", "DELIVERED", "READ"]);

export async function processOutboundMessageJob(job, overrides = {}) {
    const payload = job.data || {};
    const findMessage = overrides.findMessage || getMessageLookup;
    const dispatchMessage = overrides.sendToChannel || sendToChannel;
    const updateMessageStatus = overrides.updateMessageStatus || ConversationService.updateMessageStatus.bind(ConversationService);
    const log = overrides.logger || loggerWithScope;
    const jobName = String(job.name || "").trim();

    const currentAttempt = Number(job.attemptsMade || 0) + 1;
    const maxAttempts = Number(job.opts?.attempts || 1);

    if (jobName && jobName !== "send_message") {
        throw new NonRetryableOutboundJobError(`Unsupported outbound job type: ${jobName}`, {
            jobName,
            payloadKeys: Object.keys(payload)
        });
    }

    if (!payload.messageId) {
        throw new NonRetryableOutboundJobError("Outbound job is missing messageId", {
            jobName: jobName || "send_message",
            payloadKeys: Object.keys(payload)
        });
    }

    const existingMessage = await findMessage({
        messageId: payload.messageId,
        tenantId: payload.tenantId,
        unitId: payload.unitId
    });

    if (!existingMessage) {
        throw new NonRetryableOutboundJobError(`Outbound message ${payload.messageId} not found`, {
            jobName: jobName || "send_message",
            messageId: payload.messageId,
            tenantId: payload.tenantId,
            unitId: payload.unitId
        });
    }

    const existingStatus = normalizeStatus(existingMessage.deliveryStatus || existingMessage.status);
    if (terminalStatuses.has(existingStatus)) {
        log.info("Skipping already processed outbound message", buildLogContext(payload, {
            status: existingStatus
        }));
        return {
            skipped: true,
            status: existingStatus
        };
    }

    try {
        const dispatch = await dispatchMessage({
            tenantId: payload.tenantId,
            unitId: payload.unitId,
            conversationId: payload.conversationId,
            messageId: payload.messageId,
            text: payload.text,
            channel: payload.channel,
            externalUserId: payload.externalUserId,
            subject: payload.subject,
            metadata: payload.metadata || null
        });

        const message = await updateMessageStatus({
            messageId: payload.messageId,
            tenantId: payload.tenantId,
            unitId: payload.unitId,
            status: "SENT",
            deliveryStatus: dispatch.deliveryStatus || "SENT",
            externalMessageId: dispatch.externalMessageId,
            sentAt: new Date(),
            metadata: {
                providerResponse: dispatch.providerResponse,
                lastDispatchAttempt: currentAttempt,
                maxDispatchAttempts: maxAttempts,
                channel: payload.channel
            }
        });

        log.info("Outbound message dispatched", buildLogContext(payload, {
            status: message?.deliveryStatus || message?.status || "SENT",
            attemptsMade: currentAttempt,
            providerMessageId: dispatch.externalMessageId
        }));

        return {
            status: message?.deliveryStatus || message?.status || "SENT",
            externalMessageId: dispatch.externalMessageId
        };
    } catch (error) {
        const shouldRetry = currentAttempt < maxAttempts;
        const nextStatus = shouldRetry ? "RETRYING" : "FAILED";

        await updateMessageStatus({
            messageId: payload.messageId,
            tenantId: payload.tenantId,
            unitId: payload.unitId,
            status: nextStatus,
            deliveryStatus: nextStatus,
            metadata: {
                channelError: error instanceof Error ? error.message : String(error),
                lastDispatchAttempt: currentAttempt,
                maxDispatchAttempts: maxAttempts,
                retryScheduled: shouldRetry
            }
        });

        log.error("Outbound message dispatch failed", buildLogContext(payload, {
            status: nextStatus,
            attemptsMade: currentAttempt,
            error
        }));

        throw error;
    }
}
