import { getOutboundQueue } from "./outbound.queue.js";
// @ts-ignore
import { prisma } from "../app/prisma.js";
// @ts-ignore
import { ConversationService } from "../intelligence/services/conversation.service.js";
import { ensureChannelIdentity } from "../services/identityResolver.js";
import { logger } from "../shared/services/logger.js";

type QueueOutboundPayload = {
    tenantId: string;
    unitId: string;
    conversationId?: string;
    messageId?: string;
    entityType?: string;
    entityId?: string;
    clientId?: string | null;
    enquiryId?: string | null;
    channel: string;
    externalUserId?: string;
    recipient?: string;
    sender?: string | null;
    body?: string;
    text?: string;
    message?: string;
    subject?: string | null;
    templateName?: string | null;
    variant?: string | null;
    metadata?: Record<string, unknown> | null;
};

const outboundServiceLogger = logger.child({ scope: "outbound-service" });
const normalizeChannel = (channel: string) => String(channel || "").trim().toLowerCase();
const normalizeEntityType = (entityType?: string) => entityType ? String(entityType).trim().toUpperCase() : undefined;
const applyUnitScope = (unitId: string) => (unitId && unitId !== "ALL" ? { unitId } : {});
const pickBody = (payload: QueueOutboundPayload) => payload.body ?? payload.text ?? payload.message ?? "";

const resolveEntityContext = async ({
    tenantId,
    unitId,
    entityType,
    entityId,
    clientId,
    enquiryId
}: Pick<QueueOutboundPayload, "tenantId" | "unitId" | "entityType" | "entityId" | "clientId" | "enquiryId">) => {
    const normalizedEntityType = normalizeEntityType(entityType);

    if (normalizedEntityType === "ENQUIRY" && entityId) {
        const enquiry = await prisma.enquiry.findFirst({
            where: {
                id: entityId,
                tenantId,
                ...applyUnitScope(unitId)
            },
            select: {
                id: true,
                clientId: true
            }
        });

        return {
            entityType: normalizedEntityType,
            entityId,
            clientId: clientId || enquiry?.clientId || null,
            enquiryId: enquiryId || enquiry?.id || entityId
        };
    }

    if (normalizedEntityType === "CLIENT" && entityId) {
        return {
            entityType: normalizedEntityType,
            entityId,
            clientId: clientId || entityId,
            enquiryId: enquiryId || null
        };
    }

    return {
        entityType: normalizedEntityType,
        entityId,
        clientId: clientId || null,
        enquiryId: enquiryId || null
    };
};

export async function queueOutboundMessage(data: QueueOutboundPayload) {
    const channel = normalizeChannel(data.channel);
    const body = pickBody(data);
    const externalUserId = String(data.externalUserId || data.recipient || "").trim();

    if (!channel) {
        throw new Error("Outbound channel is required");
    }

    if (!externalUserId) {
        throw new Error(`No external recipient found for ${channel}`);
    }

    if (!body) {
        throw new Error("Outbound message body is required");
    }

    let conversationId = data.conversationId;
    let messageId = data.messageId;
    let entityType = normalizeEntityType(data.entityType);
    let entityId = data.entityId;
    let clientId = data.clientId || null;
    let enquiryId = data.enquiryId || null;
    let conversation = null;
    let message = null;

    if (!messageId) {
        const resolvedContext = await resolveEntityContext({
            tenantId: data.tenantId,
            unitId: data.unitId,
            entityType: data.entityType,
            entityId: data.entityId,
            clientId: data.clientId,
            enquiryId: data.enquiryId
        });

        entityType = resolvedContext.entityType;
        entityId = resolvedContext.entityId;
        clientId = resolvedContext.clientId;
        enquiryId = resolvedContext.enquiryId;

        const appended = await ConversationService.appendMessage({
            tenantId: data.tenantId,
            unitId: data.unitId,
            conversationId,
            entityType,
            entityId,
            clientId,
            enquiryId,
            channel,
            direction: "OUTBOUND",
            body,
            text: undefined,
            sender: data.sender || null,
            recipient: data.recipient || externalUserId,
            externalUserId,
            status: "QUEUED",
            deliveryStatus: "QUEUED",
            templateName: data.templateName || null,
            variant: data.variant || null,
            externalMessageId: undefined,
            channelId: undefined,
            metadata: {
                ...(data.metadata || {}),
                subject: data.subject || data.metadata?.subject || undefined
            },
            rawPayload: undefined
        });

        conversation = appended.conversation;
        message = appended.message;
        conversationId = conversation.id;
        messageId = message.id;
        entityType = conversation.entityType;
        entityId = conversation.entityId;
        clientId = conversation.clientId;
        enquiryId = conversation.enquiryId;
    }

    if (clientId && conversationId) {
        await ensureChannelIdentity({
            externalUserId,
            channel,
            tenantId: data.tenantId,
            unitId: data.unitId,
            clientId,
            conversationId
        });
    }

    try {
        await getOutboundQueue().add("send_message", {
            tenantId: data.tenantId,
            unitId: data.unitId,
            conversationId,
            messageId,
            entityType,
            entityId,
            clientId,
            enquiryId,
            channel,
            externalUserId,
            text: body,
            subject: data.subject || data.metadata?.subject || null,
            metadata: data.metadata || null
        });
    } catch (error) {
        if (messageId) {
            await ConversationService.updateMessageStatus({
                messageId,
                tenantId: data.tenantId,
                unitId: data.unitId,
                status: "FAILED",
                deliveryStatus: "FAILED",
                externalMessageId: undefined,
                sentAt: undefined,
                deliveredAt: undefined,
                readAt: undefined,
                metadata: {
                    queueError: error instanceof Error ? error.message : String(error)
                }
            }).catch(() => undefined);
        }

        throw error;
    }

    outboundServiceLogger.info("Queued outbound message", {
        tenantId: data.tenantId,
        unitId: data.unitId,
        conversationId,
        messageId,
        channel,
        externalUserId,
        status: "QUEUED"
    });

    return { conversation, message };
}

export async function sendWhatsAppMessage(data: {
    tenantId: string;
    unitId: string;
    conversationId?: string;
    messageId?: string;
    entityType?: string;
    entityId?: string;
    clientId?: string | null;
    enquiryId?: string | null;
    phone: string;
    message: string;
    metadata?: Record<string, unknown> | null;
}) {
    return queueOutboundMessage({
        tenantId: data.tenantId,
        unitId: data.unitId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        entityType: data.entityType,
        entityId: data.entityId,
        clientId: data.clientId,
        enquiryId: data.enquiryId,
        channel: "whatsapp",
        externalUserId: data.phone,
        recipient: data.phone,
        body: data.message,
        metadata: data.metadata || null
    });
}

export async function sendEmailMessage(data: {
    tenantId: string;
    unitId: string;
    conversationId?: string;
    messageId?: string;
    entityType?: string;
    entityId?: string;
    clientId?: string | null;
    enquiryId?: string | null;
    to: string;
    subject: string;
    text: string;
    metadata?: Record<string, unknown> | null;
}) {
    return queueOutboundMessage({
        tenantId: data.tenantId,
        unitId: data.unitId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        entityType: data.entityType,
        entityId: data.entityId,
        clientId: data.clientId,
        enquiryId: data.enquiryId,
        channel: "email",
        externalUserId: data.to,
        recipient: data.to,
        body: data.text,
        subject: data.subject,
        metadata: data.metadata || null
    });
}
