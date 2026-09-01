import crypto from "crypto";
import { ConversationService } from "../../intelligence/services/conversation.service.js";
import { IdentityResolver } from "../../services/identityResolver.js";
import { getEmailWebhookEnv, getWhatsAppWebhookEnv } from "../../config/omnichannel.js";
import { logger } from "../../shared/services/logger.js";

const webhookLogger = logger.child({ scope: "webhook-controller" });

const getHeader = (req, key) => {
    const value = req.headers[key];
    if (Array.isArray(value)) return value[0];
    return value;
};

const resolveContext = (req) => {
    const tenantId = String(
        req.query.tenantId
        || req.body?.tenantId
        || getHeader(req, "x-tenant-id")
        || process.env.DEFAULT_WEBHOOK_TENANT_ID
        || ""
    ).trim();

    const unitId = String(
        req.query.unitId
        || req.body?.unitId
        || getHeader(req, "x-unit-id")
        || process.env.DEFAULT_WEBHOOK_UNIT_ID
        || ""
    ).trim();

    if (!tenantId || !unitId) {
        throw new Error("tenantId and unitId are required for webhook requests");
    }

    return { tenantId, unitId };
};

export const verifyHmacSignature = (rawBody, signature, secret, prefix = "") => {
    const payload = Buffer.isBuffer(rawBody)
        ? rawBody
        : Buffer.from(String(rawBody || ""), "utf8");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const normalizedSignature = String(signature || "").trim().replace(prefix, "");

    if (!normalizedSignature || normalizedSignature.length !== expected.length) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(normalizedSignature),
        Buffer.from(expected)
    );
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => String(value || "").trim().replace(/[^\d]/g, "");

export const extractWhatsAppEntries = (payload) => {
    const entries = [];

    for (const entry of payload?.entry || []) {
        for (const change of entry?.changes || []) {
            const value = change?.value || {};
            const contacts = value.contacts || [];
            const messages = value.messages || [];
            const statuses = value.statuses || [];

            for (const message of messages) {
                const contact = contacts.find((item) => item?.wa_id === message?.from) || contacts[0] || {};
                let messageBody =
                    message?.text?.body
                    || message?.button?.text
                    || message?.interactive?.button_reply?.title
                    || message?.interactive?.list_reply?.title
                    || `[${message?.type || "message"}]`;
                
                messageBody = messageBody.trim();

                entries.push({
                    kind: "message",
                    externalMessageId: message?.id,
                    externalUserId: normalizePhone(message?.from || contact?.wa_id),
                    profileName: contact?.profile?.name || null,
                    body: messageBody,
                    rawPayload: message,
                    payloadContext: value
                });
            }

            for (const status of statuses) {
                entries.push({
                    kind: "status",
                    externalMessageId: status?.id,
                    deliveryStatus: String(status?.status || "").toUpperCase(),
                    timestamp: status?.timestamp,
                    rawPayload: status
                });
            }
        }
    }

    return entries;
};

export const buildEmailInbound = (payload) => {
    const from = normalizeEmail(
        payload?.from_email
        || payload?.from
        || payload?.sender
        || payload?.envelope?.from
    );
    const subject = payload?.subject || "ERP Message";
    const body = payload?.text || payload?.body || payload?.plain || subject;
    const externalMessageId = payload?.message_id || payload?.messageId || payload?.id || null;

    return {
        externalUserId: from,
        externalMessageId,
        body,
        subject,
        senderName: payload?.from_name || payload?.sender_name || null,
        rawPayload: payload
    };
};

export class WebhookController {
    static verifyWhatsApp(req, res) {
        const env = getWhatsAppWebhookEnv();
        const mode = req.query["hub.mode"];
        const token = req.query["hub.verify_token"];
        const challenge = req.query["hub.challenge"];

        if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
            return res.status(200).send(challenge);
        }

        return res.status(403).send("Forbidden");
    }

    static async processWhatsAppPayload(env, reqBody, tenantId, unitId) {
        try {
            const entries = extractWhatsAppEntries(reqBody);

            for (const entry of entries) {
                if (entry.kind === "status") {
                    if (!entry.externalMessageId) {
                        continue;
                    }

                    const timestamp = entry.timestamp ? new Date(Number(entry.timestamp) * 1000) : undefined;

                    const updatedMessage = await ConversationService.updateMessageStatusByExternalId({
                        tenantId,
                        unitId,
                        channel: "whatsapp",
                        externalMessageId: entry.externalMessageId,
                        status: entry.deliveryStatus,
                        deliveryStatus: entry.deliveryStatus,
                        deliveredAt: entry.deliveryStatus === "DELIVERED" ? timestamp : undefined,
                        readAt: entry.deliveryStatus === "READ" ? timestamp : undefined,
                        metadata: {
                            providerStatus: entry.rawPayload
                        }
                    });

                    if (!updatedMessage) {
                        webhookLogger.warn("Received WhatsApp status update for unknown message", {
                            tenantId,
                            unitId,
                            channel: "whatsapp",
                            externalMessageId: entry.externalMessageId,
                            status: entry.deliveryStatus
                        });
                    }
                    continue;
                }

                if (!entry.externalUserId || !entry.body) {
                    continue;
                }

                const resolved = await IdentityResolver.resolveConversation({
                    externalUserId: entry.externalUserId,
                    channel: "whatsapp",
                    tenantId,
                    unitId,
                    profileName: entry.profileName,
                    metadata: {
                        profileName: entry.profileName
                    }
                });

                const result = await ConversationService.addMessage({
                    tenantId,
                    unitId,
                    conversationId: resolved.conversationId,
                    entityType: "CLIENT",
                    entityId: resolved.clientId,
                    clientId: resolved.clientId,
                    channel: "whatsapp",
                    direction: "INBOUND",
                    body: entry.body,
                    sender: entry.profileName || entry.externalUserId,
                    recipient: env.WHATSAPP_PHONE_ID || null,
                    externalUserId: resolved.externalUserId,
                    externalMessageId: entry.externalMessageId,
                    status: "RECEIVED",
                    deliveryStatus: "RECEIVED",
                    metadata: {
                        profileName: entry.profileName
                    },
                    rawPayload: entry.payloadContext
                });

                if (result?.duplicate) {
                    webhookLogger.info("Ignored duplicate inbound WhatsApp message", {
                        tenantId,
                        unitId,
                        channel: "whatsapp",
                        externalUserId: resolved.externalUserId,
                        conversationId: resolved.conversationId,
                        externalMessageId: entry.externalMessageId,
                        status: "DUPLICATE"
                    });
                }
            }
        } catch (error) {
            webhookLogger.error("WhatsApp webhook async processing error", {
                error,
                tenantId,
                unitId,
                channel: "whatsapp"
            });
        }
    }

    static async whatsapp(req, res) {
        try {
            const env = getWhatsAppWebhookEnv();
            const signature = getHeader(req, "x-hub-signature-256");
            const rawBody = req.rawBody;

            if (!signature || !rawBody || !verifyHmacSignature(rawBody, signature, env.WHATSAPP_APP_SECRET, "sha256=")) {
                webhookLogger.warn("Rejected WhatsApp webhook with invalid signature", {
                    tenantId: req.query?.tenantId || req.body?.tenantId || getHeader(req, "x-tenant-id") || null,
                    unitId: req.query?.unitId || req.body?.unitId || getHeader(req, "x-unit-id") || null
                });
                return res.status(401).json({ success: false, message: "Invalid WhatsApp signature" });
            }

            const { tenantId, unitId } = resolveContext(req);

            // Respond immediately to prevent timeouts
            res.status(200).send("OK");

            // Process asynchronously
            WebhookController.processWhatsAppPayload(env, req.body, tenantId, unitId);

        } catch (error) {
            webhookLogger.error("WhatsApp webhook error", {
                error,
                tenantId: req.query?.tenantId || req.body?.tenantId || getHeader(req, "x-tenant-id") || null,
                unitId: req.query?.unitId || req.body?.unitId || getHeader(req, "x-unit-id") || null,
                channel: "whatsapp"
            });
            if (!res.headersSent) {
                return res.status(500).json({ success: false, message: error.message });
            }
        }
    }

    static async email(req, res) {
        try {
            const env = getEmailWebhookEnv();
            const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET?.trim();
            const signature = getHeader(req, "x-webhook-signature") || getHeader(req, "x-email-signature");

            if (webhookSecret && !verifyHmacSignature(req.rawBody, signature, webhookSecret)) {
                return res.status(401).json({ success: false, message: "Invalid email signature" });
            }

            const { tenantId, unitId } = resolveContext(req);
            const inbound = buildEmailInbound(req.body);

            if (!inbound.externalUserId || !inbound.body) {
                return res.status(400).json({ success: false, message: "Invalid email payload" });
            }

            const resolved = await IdentityResolver.resolveConversation({
                externalUserId: inbound.externalUserId,
                channel: "email",
                tenantId,
                unitId,
                profileName: inbound.senderName,
                profileEmail: inbound.externalUserId,
                subject: inbound.subject,
                metadata: {
                    subject: inbound.subject
                }
            });

            const result = await ConversationService.addMessage({
                tenantId,
                unitId,
                conversationId: resolved.conversationId,
                entityType: "CLIENT",
                entityId: resolved.clientId,
                clientId: resolved.clientId,
                channel: "email",
                direction: "INBOUND",
                body: inbound.body,
                sender: inbound.senderName || inbound.externalUserId,
                recipient: env.EMAIL_USER || null,
                externalUserId: resolved.externalUserId,
                externalMessageId: inbound.externalMessageId,
                status: "RECEIVED",
                deliveryStatus: "RECEIVED",
                metadata: {
                    subject: inbound.subject
                },
                rawPayload: inbound.rawPayload
            });

            if (result?.duplicate) {
                webhookLogger.info("Ignored duplicate inbound email message", {
                    tenantId,
                    unitId,
                    channel: "email",
                    externalUserId: resolved.externalUserId,
                    conversationId: resolved.conversationId,
                    externalMessageId: inbound.externalMessageId,
                    status: "DUPLICATE"
                });
            }

            return res.status(200).json({ success: true, conversationId: result.conversation?.id || resolved.conversationId });
        } catch (error) {
            webhookLogger.error("Email webhook error", {
                error,
                tenantId: req.query?.tenantId || req.body?.tenantId || getHeader(req, "x-tenant-id") || null,
                unitId: req.query?.unitId || req.body?.unitId || getHeader(req, "x-unit-id") || null,
                channel: "email"
            });
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
