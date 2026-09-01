import { ConversationService } from "../../intelligence/services/conversation.service.js";
import {
    IdentityResolver,
    ensureChannelIdentity,
    ensureConversationChannelRecipients
} from "../../services/identityResolver.js";
import { queueOutboundMessage } from "../../outbound/outbound.service.js";
import { success } from "../../shared/utils/response.js";

export const handleCreateConversation = async (req, res, next) => {
    try {
        const conversation = await ConversationService.ensureConversation({
            tenantId: req.user.tenantId,
            unitId: req.context?.unitId || req.user.unitId,
            ...req.body
        });
        return success(res, conversation, { message: "Conversation created" });
    } catch (error) {
        next(error);
    }
};

export const handleListConversations = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        const conversations = await ConversationService.listConversations(
            tenantId,
            unitId,
            req.query
        );
        const hydratedConversations = await Promise.all(
            conversations.map((conversation) =>
                ensureConversationChannelRecipients({
                    conversation,
                    tenantId,
                    unitId
                })
            )
        );
        return success(res, hydratedConversations);
    } catch (error) {
        next(error);
    }
};

export const handleGetConversation = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        const conversation = await ConversationService.getConversationById(
            req.params.id,
            tenantId,
            unitId
        );
        const hydratedConversation = await ensureConversationChannelRecipients({
            conversation,
            tenantId,
            unitId
        });
        return success(res, hydratedConversation);
    } catch (error) {
        next(error);
    }
};

export const handleAppendMessage = async (req, res, next) => {
    try {
        const tenantId = req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        const requestedDirection = req.body.direction ? String(req.body.direction).toUpperCase() : "OUTBOUND";

        if (requestedDirection !== "OUTBOUND") {
            const result = await ConversationService.appendMessage({
                tenantId,
                unitId,
                ...req.body
            });
            return success(res, result, { message: "Message added to conversation" });
        }

        let conversation = req.body.conversationId
            ? await ConversationService.getConversationById(req.body.conversationId, tenantId, unitId)
            : null;

        if (!conversation && req.body.conversationId) {
            // Relaxed lookup in case of unitId mismatch
            conversation = await prisma.conversation.findFirst({
                 where: { id: req.body.conversationId, tenantId },
                 include: {
                     client: true,
                     enquiry: true,
                     channelIdentities: true,
                     messages: { orderBy: { createdAt: "asc" } }
                 }
            });
        }

        if (!conversation && req.body.entityId && req.body.entityType) {
            const created = await ConversationService.ensureConversation({
                tenantId,
                unitId,
                entityType: req.body.entityType,
                entityId: req.body.entityId,
                clientId: req.body.clientId,
                enquiryId: req.body.enquiryId,
                channel: req.body.channel
            });
            conversation = await ConversationService.getConversationById(created.id, tenantId, unitId);
        }

        if (!conversation) {
            console.error("Conversation not found! Body:", req.body, "tenantId:", tenantId, "unitId:", unitId);
            throw new Error("Conversation not found");
        }

        const isOptimisticRetry = req.body.retryMessageId && req.body.retryMessageId.startsWith('temp-');
        const retryMessage = (req.body.retryMessageId && !isOptimisticRetry)
            ? conversation.messages?.find((message) => message.id === req.body.retryMessageId)
            : null;

        if (req.body.retryMessageId && !isOptimisticRetry && !retryMessage) {
            throw new Error("Retry source message not found in the selected conversation");
        }

        const replyChannel = ((req.body.channel
            || retryMessage?.channel
            || await ConversationService.getDefaultReplyChannel(conversation.id, tenantId, unitId)
            || conversation.channel
            || "whatsapp")).toLowerCase();

        conversation = await ensureConversationChannelRecipients({
            conversation,
            tenantId,
            unitId,
            preferredEmail: replyChannel === "email"
                ? (req.body.externalUserId || retryMessage?.externalUserId || null)
                : null,
            preferredWhatsApp: replyChannel === "whatsapp"
                ? (req.body.externalUserId || retryMessage?.externalUserId || null)
                : null,
            preferredSms: replyChannel === "sms"
                ? (req.body.externalUserId || retryMessage?.externalUserId || null)
                : null
        });

        if (replyChannel === "email" && !conversation?.client?.email) {
            throw new Error("Customer email is required to send email");
        }

        const externalUserId = replyChannel === "email"
            ? String(
                conversation?.client?.email
                || req.body.externalUserId
                || retryMessage?.externalUserId
                || ""
            ).trim().toLowerCase()
            : (
                req.body.externalUserId
                || retryMessage?.externalUserId
                || await IdentityResolver.resolveExternalUserIdForConversation({
                    conversationId: conversation.id,
                    channel: replyChannel,
                    tenantId,
                    unitId
                })
            );

        if (!externalUserId) {
            throw new Error(`No external recipient found for ${replyChannel}`);
        }

        const messageBody = req.body.body
            ?? req.body.text
            ?? retryMessage?.body;

        if (!messageBody) {
            throw new Error("Message body is required");
        }

        const subject = req.body.subject
            || retryMessage?.metadata?.subject
            || conversation.subject
            || "ERP Message";
        const outboundMetadata = {
            ...(req.body.metadata || {}),
            subject,
            retriedFromMessageId: retryMessage?.id || undefined
        };

        if (conversation.clientId) {
            await ensureChannelIdentity({
                externalUserId,
                channel: replyChannel,
                tenantId,
                unitId,
                clientId: conversation.clientId,
                conversationId: conversation.id
            });
        }

        const result = await ConversationService.appendMessage({
            tenantId,
            unitId,
            conversationId: conversation.id,
            entityType: conversation.entityType,
            entityId: conversation.entityId,
            clientId: conversation.clientId,
            enquiryId: conversation.enquiryId,
            body: messageBody,
            channel: replyChannel,
            direction: "OUTBOUND",
            sender: req.user.email || req.user.id,
            recipient: externalUserId,
            externalUserId,
            status: "QUEUED",
            deliveryStatus: "QUEUED",
            metadata: outboundMetadata
        });

        try {
            await queueOutboundMessage({
                tenantId,
                unitId,
                conversationId: conversation.id,
                messageId: result.message.id,
                text: result.message.body,
                channel: replyChannel,
                externalUserId,
                subject,
                metadata: outboundMetadata
            });

            return success(res, result, { message: "Message queued for delivery" });
        } catch (queueError) {
            await ConversationService.updateMessageStatus({
                messageId: result.message.id,
                tenantId,
                unitId,
                status: "FAILED",
                deliveryStatus: "FAILED",
                metadata: {
                    queueError: queueError.message
                }
            });
            throw queueError;
        }
    } catch (error) {
        next(error);
    }
};
