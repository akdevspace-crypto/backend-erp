import { prisma } from "../../app/prisma.js";
import { emitRealtimeEvent, emitRoomEvent } from "../../shared/services/socket.js";
import { logger } from "../../shared/services/logger.js";

const normalizeDirection = (direction = "SYSTEM") => String(direction).toUpperCase();
const normalizeStatus = (value, fallback = null) => {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value).toUpperCase();
};
const normalizeChannel = (channel = "") => String(channel).trim().toLowerCase();
const applyUnitScope = (unitId) => (unitId && unitId !== "ALL" ? { unitId } : {});
const buildScopedWhere = (tenantId, unitId, extra = {}) => ({
    tenantId,
    ...applyUnitScope(unitId),
    ...extra
});
const isObjectLike = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const mergeMetadata = (currentValue, nextValue) => {
    if (isObjectLike(currentValue) && isObjectLike(nextValue)) {
        return { ...currentValue, ...nextValue };
    }
    return nextValue ?? currentValue ?? null;
};
const lifecycleStatusWeights = {
    FAILED: -1,
    QUEUED: 0,
    RETRYING: 1,
    RECEIVED: 1,
    SENT: 2,
    DELIVERED: 3,
    READ: 4
};
const loggerWithScope = logger.child({ scope: "conversation-service" });
const emitConversationEvent = ({ conversationId, tenantId, unitId, type, message }) => {
    const payload = { type, conversationId, tenantId, unitId, message };
    
    // Broadcast to specific conversation room
    emitRoomEvent(conversationId, `conversation:${conversationId}`, payload);
    if (type) {
        emitRoomEvent(conversationId, type, payload);
    }

    // Broadcast to global or tenant room for sidebar updates
    emitRealtimeEvent("conversation:update", payload);
};
const buildConversationLookupClauses = ({ clientId, enquiryId, entityType, entityId }) => {
    const clauses = [];
    if (clientId) clauses.push({ clientId });
    if (enquiryId) clauses.push({ enquiryId });
    if (entityType && entityId) clauses.push({ entityType, entityId });
    return clauses;
};
const resolveLifecycleStatus = (currentValue, nextValue) => {
    const current = normalizeStatus(currentValue);
    const next = normalizeStatus(nextValue, current);

    if (!next) return current || null;
    if (!current) return next;
    if (next === "FAILED") {
        return ["SENT", "DELIVERED", "READ"].includes(current) ? current : next;
    }

    const currentWeight = lifecycleStatusWeights[current];
    const nextWeight = lifecycleStatusWeights[next];

    if (currentWeight === undefined || nextWeight === undefined) {
        return next;
    }

    return nextWeight >= currentWeight ? next : current;
};
const deriveMessageEventType = (message) => {
    const status = normalizeStatus(message.deliveryStatus, message.status);

    if (status === "READ" || message.readAt) return "MESSAGE_READ";
    if (status === "DELIVERED" || message.deliveredAt) return "MESSAGE_DELIVERED";
    if (status === "FAILED") return "MESSAGE_FAILED";
    if (status === "RETRYING") return "MESSAGE_RETRYING";
    if (status === "QUEUED") return "MESSAGE_QUEUED";
    if (status === "SENT") return "MESSAGE_SENT";
    return "MESSAGE_UPDATED";
};
const isUniqueConstraintError = (error) => error?.code === "P2002";
const loadExistingMessageByExternalId = async ({
    tenantId,
    unitId,
    channel,
    externalMessageId
}) => {
    if (!externalMessageId) return null;

    return prisma.message.findFirst({
        where: buildScopedWhere(tenantId, unitId, {
            channel: normalizeChannel(channel),
            externalMessageId
        })
    });
};

export class ConversationService {
    static async ensureConversation({
        tenantId,
        unitId,
        entityType,
        entityId,
        clientId,
        enquiryId,
        channel,
        subject,
        externalThreadId,
        metadata
    }) {
        const lookupClauses = buildConversationLookupClauses({ clientId, enquiryId, entityType, entityId });
        const where = buildScopedWhere(tenantId, unitId, {
            status: { not: "CLOSED" },
            ...(lookupClauses.length > 1 ? { OR: lookupClauses } : lookupClauses[0] || {})
        });

        const existing = lookupClauses.length
            ? await prisma.conversation.findFirst({
                where,
                orderBy: { updatedAt: "desc" }
            })
            : null;

        if (existing) {
            const updateData = {};
            const mergedMetadata = mergeMetadata(existing.metadata, metadata);

            if (!existing.clientId && clientId) updateData.clientId = clientId;
            if (!existing.enquiryId && enquiryId) updateData.enquiryId = enquiryId;
            if (channel && existing.channel !== normalizeChannel(channel)) updateData.channel = normalizeChannel(channel);
            if (subject && !existing.subject) updateData.subject = subject;
            if (externalThreadId && !existing.externalThreadId) updateData.externalThreadId = externalThreadId;
            if (mergedMetadata !== existing.metadata) updateData.metadata = mergedMetadata;

            if (Object.keys(updateData).length > 0) {
                return prisma.conversation.update({
                    where: { id: existing.id },
                    data: updateData
                });
            }

            return existing;
        }

        return prisma.conversation.create({
            data: {
                tenantId,
                unitId,
                entityType,
                entityId,
                clientId,
                enquiryId,
                channel: normalizeChannel(channel),
                subject,
                externalThreadId,
                metadata,
                lastMessageAt: new Date()
            }
        });
    }

    static async appendMessage({
        tenantId,
        unitId,
        conversationId,
        entityType,
        entityId,
        clientId,
        enquiryId,
        channel,
        direction,
        body,
        text,
        sender,
        recipient,
        status,
        templateName,
        variant,
        externalUserId,
        externalMessageId,
        deliveryStatus,
        channelId,
        metadata,
        rawPayload
    }) {
        const normalizedChannel = normalizeChannel(channel);
        const normalizedDirection = normalizeDirection(direction);
        const normalizedBody = body ?? text;
        const normalizedStatus = normalizeStatus(status, normalizedDirection === "INBOUND" ? "RECEIVED" : "QUEUED");
        const normalizedDeliveryStatus = normalizeStatus(deliveryStatus, normalizedStatus);

        if (!normalizedBody) {
            throw new Error("Message body is required");
        }

        if (externalMessageId) {
            const existingMessage = await loadExistingMessageByExternalId({
                tenantId,
                unitId,
                channel: normalizedChannel,
                externalMessageId
            });

            if (existingMessage) {
                const conversation = await prisma.conversation.findFirst({
                    where: buildScopedWhere(tenantId, unitId, {
                        id: existingMessage.conversationId
                    })
                });

                return {
                    conversation,
                    message: existingMessage,
                    duplicate: true
                };
            }
        }

        const conversation = conversationId
            ? await prisma.conversation.findFirst({
                where: buildScopedWhere(tenantId, unitId, { id: conversationId })
            })
            : await this.ensureConversation({
                tenantId,
                unitId,
                entityType,
                entityId,
                clientId,
                enquiryId,
                channel: normalizedChannel,
                subject: metadata?.subject,
                externalThreadId: metadata?.externalThreadId,
                metadata
            });

        if (!conversation) throw new Error("Conversation could not be resolved");

        let message;

        try {
            message = await prisma.message.create({
                data: {
                    tenantId,
                    unitId,
                    conversationId: conversation.id,
                    direction: normalizedDirection,
                    channel: normalizedChannel,
                    sender,
                    recipient,
                    body: normalizedBody,
                    status: normalizedStatus,
                    templateName,
                    variant,
                    externalUserId,
                    externalMessageId,
                    deliveryStatus: normalizedDeliveryStatus,
                    metadata,
                    sentAt: normalizedDirection === "OUTBOUND" && ["SENT", "DELIVERED", "READ"].includes(normalizedStatus)
                        ? new Date()
                        : null
                }
            });
        } catch (error) {
            if (externalMessageId && isUniqueConstraintError(error)) {
                const existingMessage = await loadExistingMessageByExternalId({
                    tenantId,
                    unitId,
                    channel: normalizedChannel,
                    externalMessageId
                });

                if (existingMessage) {
                    loggerWithScope.info("Duplicate message create prevented by unique constraint", {
                        tenantId,
                        unitId,
                        conversationId: existingMessage.conversationId,
                        channel: normalizedChannel,
                        externalMessageId
                    });

                    return {
                        conversation,
                        message: existingMessage,
                        duplicate: true
                    };
                }
            }

            throw error;
        }

        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt: message.createdAt,
                status: normalizedDirection === "INBOUND" ? "OPEN" : conversation.status,
                channel: normalizedChannel,
                lastInboundChannel: normalizedDirection === "INBOUND"
                    ? normalizedChannel
                    : conversation.lastInboundChannel,
                clientId: conversation.clientId || clientId || undefined,
                enquiryId: conversation.enquiryId || enquiryId || undefined,
                subject: conversation.subject || metadata?.subject || undefined
            }
        });

        await prisma.communicationLog.create({
            data: {
                tenantId,
                unitId,
                entityType: entityType || conversation.entityType,
                entityId: entityId || conversation.entityId,
                conversationId: conversation.id,
                channel: normalizedChannel,
                channelId,
                direction: normalizedDirection,
                message: normalizedBody,
                status: normalizedStatus,
                templateName,
                externalMessageId,
                metadata,
                rawPayload
            }
        });

        loggerWithScope.info("Message appended to conversation", {
            tenantId,
            unitId,
            conversationId: conversation.id,
            messageId: message.id,
            channel: normalizedChannel,
            externalUserId,
            status: normalizedDeliveryStatus,
            direction: normalizedDirection
        });

        emitConversationEvent({
            conversationId: conversation.id,
            tenantId,
            unitId,
            type: "NEW_MESSAGE",
            message
        });

        if (normalizedDirection === "OUTBOUND" && normalizedStatus === "SENT") {
            emitConversationEvent({
                conversationId: conversation.id,
                tenantId,
                unitId,
                type: "MESSAGE_SENT",
                message
            });
        }

        return { conversation, message };
    }

    static async listConversations(tenantId, unitId, filters = {}) {
        const where = buildScopedWhere(tenantId, unitId);
        const normalizedEntityTypeFilter = filters.entityType ? String(filters.entityType).toUpperCase() : "";
        const includeInternal = String(filters.includeInternal || "").trim().toLowerCase() === "true";

        if (!includeInternal && normalizedEntityTypeFilter !== "INTERNAL") {
            where.NOT = { entityType: "INTERNAL" };
        }

        if (filters.entityType && filters.entityId) {
            const normalizedEntityType = normalizedEntityTypeFilter;

            if (normalizedEntityType === "ENQUIRY") {
                const enquiry = await prisma.enquiry.findFirst({
                    where: buildScopedWhere(tenantId, unitId, { id: filters.entityId }),
                    select: { id: true, clientId: true }
                });

                where.OR = [
                    { entityType: filters.entityType, entityId: filters.entityId },
                    { enquiryId: filters.entityId },
                    ...(enquiry?.clientId ? [{ clientId: enquiry.clientId }] : [])
                ];
            } else if (normalizedEntityType === "CLIENT") {
                where.OR = [
                    { entityType: filters.entityType, entityId: filters.entityId },
                    { clientId: filters.entityId }
                ];
            } else {
                where.entityType = filters.entityType;
                where.entityId = filters.entityId;
            }
        } else {
            if (filters.entityType) where.entityType = filters.entityType;
            if (filters.entityId) where.entityId = filters.entityId;
        }

        if (filters.channel) where.channel = normalizeChannel(filters.channel);
        if (filters.status) where.status = filters.status;

        return prisma.conversation.findMany({
            where,
            include: {
                client: true,
                enquiry: true,
                channelIdentities: true,
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: filters.messageLimit ? Number(filters.messageLimit) : 20
                }
            },
            orderBy: { lastMessageAt: "desc" },
            take: filters.limit ? Number(filters.limit) : 50
        });
    }

    static async getConversationById(id, tenantId, unitId) {
        return prisma.conversation.findFirst({
            where: buildScopedWhere(tenantId, unitId, { id }),
            include: {
                client: true,
                enquiry: true,
                channelIdentities: true,
                messages: { orderBy: { createdAt: "asc" } }
            }
        });
    }

    static async getDefaultReplyChannel(conversationId, tenantId, unitId) {
        const conversation = await prisma.conversation.findFirst({
            where: buildScopedWhere(tenantId, unitId, { id: conversationId }),
            select: {
                channel: true,
                lastInboundChannel: true
            }
        });

        if (!conversation) return null;
        if (conversation.lastInboundChannel) return conversation.lastInboundChannel;

        const lastInboundMessage = await prisma.message.findFirst({
            where: buildScopedWhere(tenantId, unitId, {
                conversationId,
                direction: "INBOUND"
            }),
            orderBy: { createdAt: "desc" },
            select: { channel: true }
        });

        return lastInboundMessage?.channel || conversation.channel || null;
    }

    static async updateMessageStatus({
        messageId,
        tenantId,
        unitId,
        status,
        deliveryStatus,
        externalMessageId,
        sentAt,
        deliveredAt,
        readAt,
        metadata
    }) {
        const existingMessage = await prisma.message.findFirst({
            where: buildScopedWhere(tenantId, unitId, { id: messageId })
        });

        if (!existingMessage) return null;

        const requestedStatus = resolveLifecycleStatus(existingMessage.status, status);
        const requestedDeliveryStatus = resolveLifecycleStatus(
            existingMessage.deliveryStatus || existingMessage.status,
            deliveryStatus || status
        );
        const nextStatus = resolveLifecycleStatus(requestedStatus, requestedDeliveryStatus) || existingMessage.status;
        const mergedMetadata = mergeMetadata(existingMessage.metadata, metadata);
        const nextSentAt = sentAt !== undefined
            ? sentAt
            : (["SENT", "DELIVERED", "READ"].includes(nextStatus || "")
                ? (existingMessage.sentAt || new Date())
                : existingMessage.sentAt);
        const nextDeliveredAt = deliveredAt !== undefined
            ? deliveredAt
            : (requestedDeliveryStatus === "DELIVERED" && !existingMessage.deliveredAt
                ? new Date()
                : (readAt ? readAt : existingMessage.deliveredAt));
        const nextReadAt = readAt !== undefined
            ? readAt
            : (requestedDeliveryStatus === "READ" && !existingMessage.readAt
                ? new Date()
                : existingMessage.readAt);

        const nextMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                status: nextStatus,
                deliveryStatus: requestedDeliveryStatus,
                externalMessageId: externalMessageId === undefined ? existingMessage.externalMessageId : externalMessageId,
                sentAt: nextSentAt,
                deliveredAt: nextDeliveredAt,
                readAt: nextReadAt,
                metadata: mergedMetadata
            }
        });

        await prisma.communicationLog.create({
            data: {
                tenantId,
                unitId,
                entityType: "MESSAGE",
                entityId: nextMessage.id,
                conversationId: nextMessage.conversationId,
                channel: nextMessage.channel,
                direction: nextMessage.direction,
                message: nextMessage.body,
                status: nextMessage.deliveryStatus || nextMessage.status,
                templateName: nextMessage.templateName,
                externalMessageId: nextMessage.externalMessageId,
                metadata: mergedMetadata
            }
        });

        loggerWithScope.info("Message status updated", {
            tenantId,
            unitId,
            conversationId: nextMessage.conversationId,
            messageId: nextMessage.id,
            channel: nextMessage.channel,
            externalUserId: nextMessage.externalUserId,
            status: nextMessage.deliveryStatus || nextMessage.status
        });

        emitConversationEvent({
            conversationId: nextMessage.conversationId,
            tenantId,
            unitId,
            type: deriveMessageEventType(nextMessage),
            message: nextMessage
        });

        return nextMessage;
    }

    static async updateMessageStatusByExternalId({
        tenantId,
        unitId,
        channel,
        externalMessageId,
        ...rest
    }) {
        if (!externalMessageId) return null;

        const existingMessage = await prisma.message.findFirst({
            where: buildScopedWhere(tenantId, unitId, {
                channel: normalizeChannel(channel),
                externalMessageId
            })
        });

        if (!existingMessage) return null;

        return this.updateMessageStatus({
            messageId: existingMessage.id,
            tenantId,
            unitId,
            externalMessageId,
            ...rest
        });
    }

    static async addMessage(payload) {
        return this.appendMessage(payload);
    }
}
