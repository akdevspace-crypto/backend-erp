import { ConversationService } from "../../intelligence/services/conversation.service.js";
import twilio from "twilio";
import { ensureChannelIdentity, IdentityResolver } from "../../services/identityResolver.js";
import { sendSMS } from "../../services/twilioService.js";
import { getTwilioEnv } from "../../config/omnichannel.js";
import { CallHistoryService, isTerminalCallStatus, normalizeCallStatus } from "../exotel/callHistory.service.js";
import { logger } from "../../shared/services/logger.js";
import { success } from "../../shared/utils/response.js";
import { addWebhookEventJob } from "../calls/queues.js";

const twilioLogger = logger.child({ scope: "twilio-controller" });

const getHeader = (req, key) => {
    const value = req.headers[key];
    if (Array.isArray(value)) return value[0];
    return value;
};

const getBodyValue = (body, keys) => {
    for (const key of keys) {
        const value = body?.[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            return value;
        }
    }

    return "";
};

const resolveWebhookContext = (req) => {
    const tenantId = String(
        req.query?.tenantId
        || req.body?.tenantId
        || getHeader(req, "x-tenant-id")
        || process.env.DEFAULT_WEBHOOK_TENANT_ID
        || ""
    ).trim();

    const unitId = String(
        req.query?.unitId
        || req.body?.unitId
        || getHeader(req, "x-unit-id")
        || process.env.DEFAULT_WEBHOOK_UNIT_ID
        || ""
    ).trim();

    if (!tenantId || !unitId) {
        throw new Error("tenantId and unitId are required for Twilio webhooks");
    }

    return { tenantId, unitId };
};

const pickOutboundBody = (body) => String(body?.message ?? body?.body ?? body?.text ?? "").trim();
const parseWebhookDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeTwilioDirection = (value) => {
    const direction = String(value || "").trim().toLowerCase();
    if (direction.includes("outbound")) return "outbound";
    return "inbound";
};

const buildCallBody = ({ direction, status, customerPhone, duration }) => {
    const label = direction === "outbound" ? "Outgoing call" : "Incoming call";
    const normalizedStatus = normalizeCallStatus(status);
    const suffix = duration ? ` (${duration}s)` : "";
    if (normalizedStatus === "MISSED") return `${label} missed from ${customerPhone}`;
    if (normalizedStatus === "ONGOING") return `${label} connected${suffix}`;
    if (isTerminalCallStatus(normalizedStatus)) return `${label} ended${suffix}`;
    return `${label} ${normalizedStatus || "started"}`;
};

const isTwilioWebhookAuthorized = (req) => {
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || "").trim();
    if (!authToken) return true;

    const signature = String(getHeader(req, "x-twilio-signature") || "").trim();
    if (!signature) return false;

    try {
        const protocol = getHeader(req, "x-forwarded-proto") || req.protocol || "http";
        const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host");
        const url = `${protocol}://${host}${req.originalUrl}`;
        return twilio.validateRequest(authToken, signature, url, req.body || {});
    } catch {
        return false;
    }
};

export class TwilioController {
    static async callWebhook(req, res) {
        if (!isTwilioWebhookAuthorized(req)) {
            return res.sendStatus(401);
        }

        const webhookRequest = {
            body: req.body,
            query: req.query,
            headers: req.headers,
            protocol: req.protocol,
            originalUrl: req.originalUrl
        };

        res.status(200).send("OK");

        addWebhookEventJob({ provider: "twilio", request: webhookRequest }).catch((queueError) => {
            twilioLogger.error("Failed to queue Twilio webhook; falling back to inline async processing", { error: queueError });
            setImmediate(() => {
                TwilioController.processCallWebhookEvent(webhookRequest).catch((error) => {
                    twilioLogger.error("Async Twilio call webhook processing failed", { error, payload: webhookRequest.body });
                });
            });
        });
    }

    static async processCallWebhookEvent(req) {
        try {
            const { tenantId, unitId } = resolveWebhookContext(req);
            const callSid = String(getBodyValue(req.body, ["CallSid", "callSid", "Sid", "sid"])).trim();
            const rawStatus = String(getBodyValue(req.body, ["CallStatus", "callStatus", "Status", "status"])).trim();
            const status = normalizeCallStatus(rawStatus || "ringing");
            const direction = normalizeTwilioDirection(getBodyValue(req.body, ["Direction", "direction"]));
            const from = IdentityResolver.normalizeExternalUserId("call", getBodyValue(req.body, ["From", "from"]));
            const servicePhone = String(process.env.TWILIO_PHONE_NUMBER || "").trim();
            const to = IdentityResolver.normalizeExternalUserId("call", getBodyValue(req.body, ["To", "to"]) || servicePhone);
            const customerPhone = direction === "outbound" ? to : from;
            const startedAt = parseWebhookDate(getBodyValue(req.body, ["StartTime", "startTime", "Timestamp", "timestamp"])) || new Date();
            const endedAt = parseWebhookDate(getBodyValue(req.body, ["EndTime", "endTime"])) || (isTerminalCallStatus(status) ? new Date() : null);
            const durationValue = getBodyValue(req.body, ["CallDuration", "Duration", "duration"]);
            const duration = durationValue === "" ? null : Number(durationValue);
            const recordingUrl = String(getBodyValue(req.body, ["RecordingUrl", "RecordingURL", "recordingUrl"])).trim() || null;

            if (!callSid || !customerPhone) {
                twilioLogger.warn("Ignoring Twilio call webhook without CallSid or customer phone", { payload: req.body });
                return;
            }

            const resolved = await IdentityResolver.resolveConversation({
                externalUserId: customerPhone,
                channel: "call",
                tenantId,
                unitId,
                metadata: {
                    provider: "twilio",
                    direction,
                    from,
                    to
                }
            });

            const messagePayload = {
                status: String(status || "ringing").toUpperCase(),
                deliveryStatus: String(status || "ringing").toUpperCase(),
                externalMessageId: callSid,
                metadata: {
                    provider: "twilio",
                    direction,
                    from,
                    to,
                    callSid,
                    callStatus: status,
                    duration: Number.isFinite(duration) ? duration : null,
                    recordingUrl,
                    rawPayload: req.body
                }
            };

            const updatedMessage = await ConversationService.updateMessageStatusByExternalId({
                tenantId,
                unitId,
                channel: "call",
                externalMessageId: callSid,
                ...messagePayload
            });

            if (!updatedMessage) {
                await ConversationService.addMessage({
                    tenantId,
                    unitId,
                    conversationId: resolved.conversationId,
                    entityType: "CLIENT",
                    entityId: resolved.clientId,
                    clientId: resolved.clientId,
                    channel: "call",
                    direction: direction === "outbound" ? "OUTBOUND" : "INBOUND",
                    body: buildCallBody({ direction, status, customerPhone, duration }),
                    sender: direction === "outbound" ? (to || servicePhone) : customerPhone,
                    recipient: direction === "outbound" ? customerPhone : (to || servicePhone),
                    externalUserId: customerPhone,
                    ...messagePayload,
                    rawPayload: req.body
                });
            }

            await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                conversationId: resolved.conversationId,
                customerPhone,
                provider: "twilio",
                direction,
                status,
                duration: Number.isFinite(duration) ? duration : null,
                recordingUrl,
                callSid,
                startedAt,
                endedAt
            });

            return { success: true };
        } catch (error) {
            twilioLogger.error("Twilio call webhook failed", {
                error,
                payload: req.body
            });
            throw error;
        }
    }

    static async incomingSMS(req, res, next) {
        try {
            const { tenantId, unitId } = resolveWebhookContext(req);
            const env = getTwilioEnv();
            const from = IdentityResolver.normalizeExternalUserId("sms", getBodyValue(req.body, ["From", "from"]));
            const to = String(getBodyValue(req.body, ["To", "to"]) || env.TWILIO_PHONE_NUMBER).trim();
            const text = String(getBodyValue(req.body, ["Body", "body", "text"])).trim();
            const messageSid = String(getBodyValue(req.body, ["MessageSid", "SmsSid", "SmsMessageSid", "sid"])).trim() || null;

            if (!from || !text) {
                return res.status(400).json({ success: false, message: "From and Body are required for inbound SMS" });
            }

            const resolved = await IdentityResolver.resolveConversation({
                externalUserId: from,
                channel: "sms",
                tenantId,
                unitId,
                metadata: {
                    provider: "twilio",
                    direction: "inbound",
                    to
                }
            });

            const result = await ConversationService.addMessage({
                tenantId,
                unitId,
                conversationId: resolved.conversationId,
                entityType: "CLIENT",
                entityId: resolved.clientId,
                clientId: resolved.clientId,
                channel: "sms",
                direction: "INBOUND",
                body: text,
                sender: resolved.externalUserId,
                recipient: to || null,
                externalUserId: resolved.externalUserId,
                externalMessageId: messageSid,
                status: "RECEIVED",
                deliveryStatus: "RECEIVED",
                metadata: {
                    provider: "twilio",
                    direction: "inbound",
                    from: resolved.externalUserId,
                    to
                },
                rawPayload: req.body
            });

            if (result?.duplicate) {
                twilioLogger.info("Ignored duplicate inbound SMS", {
                    tenantId,
                    unitId,
                    channel: "sms",
                    conversationId: resolved.conversationId,
                    externalMessageId: messageSid
                });
            }

            return res.status(200).send("OK");
        } catch (error) {
            twilioLogger.error("Twilio inbound SMS webhook failed", {
                error,
                payload: req.body
            });
            next(error);
        }
    }

    static async outboundSMS(req, res, next) {
        const tenantId = req.user.tenantId;
        const unitId = req.context?.unitId || req.user.unitId;
        const conversationId = String(req.body?.conversationId || "").trim();

        if (!conversationId) {
            return res.status(400).json({ success: false, message: "conversationId is required" });
        }

        try {
            const conversation = await ConversationService.getConversationById(conversationId, tenantId, unitId);

            if (!conversation) {
                return res.status(404).json({ success: false, message: "Conversation not found" });
            }

            const to = IdentityResolver.normalizeExternalUserId(
                "sms",
                String(
                    req.body?.to
                    || req.body?.externalUserId
                    || await IdentityResolver.resolveExternalUserIdForConversation({
                        conversationId,
                        channel: "sms",
                        tenantId,
                        unitId
                    })
                    || ""
                )
            );
            const messageBody = pickOutboundBody(req.body);

            if (!to) {
                return res.status(400).json({ success: false, message: "Customer phone number is required to send SMS" });
            }

            if (!messageBody) {
                return res.status(400).json({ success: false, message: "Message body is required" });
            }

            const initialMessage = await ConversationService.addMessage({
                tenantId,
                unitId,
                conversationId: conversation.id,
                entityType: conversation.entityType,
                entityId: conversation.entityId,
                clientId: conversation.clientId,
                enquiryId: conversation.enquiryId,
                channel: "sms",
                direction: "OUTBOUND",
                body: messageBody,
                sender: req.user.email || req.user.id,
                recipient: to,
                externalUserId: to,
                status: "QUEUED",
                deliveryStatus: "QUEUED",
                metadata: {
                    provider: "twilio",
                    direction: "outbound",
                    initiatedByUserId: req.user.id
                }
            });

            if (conversation.clientId) {
                await ensureChannelIdentity({
                    externalUserId: to,
                    channel: "sms",
                    tenantId,
                    unitId,
                    clientId: conversation.clientId,
                    conversationId: conversation.id
                });
            }

            try {
                const response = await sendSMS(to, messageBody);
                const updatedMessage = await ConversationService.updateMessageStatus({
                    messageId: initialMessage.message.id,
                    tenantId,
                    unitId,
                    status: "SENT",
                    deliveryStatus: String(response.status || "SENT").toUpperCase(),
                    externalMessageId: response.sid,
                    sentAt: new Date(),
                    metadata: {
                        provider: "twilio",
                        direction: "outbound",
                        providerResponse: {
                            sid: response.sid,
                            status: response.status,
                            from: response.from,
                            to: response.to
                        }
                    }
                });

                return success(res, {
                    conversationId: conversation.id,
                    message: updatedMessage,
                    externalMessageId: response.sid,
                    status: updatedMessage?.deliveryStatus || updatedMessage?.status || "SENT"
                }, { message: "SMS sent" });
            } catch (smsError) {
                await ConversationService.updateMessageStatus({
                    messageId: initialMessage.message.id,
                    tenantId,
                    unitId,
                    status: "FAILED",
                    deliveryStatus: "FAILED",
                    metadata: {
                        provider: "twilio",
                        errorMessage: smsError instanceof Error ? smsError.message : String(smsError)
                    }
                }).catch(() => undefined);

                throw smsError;
            }
        } catch (error) {
            twilioLogger.error("Failed to send outbound Twilio SMS", {
                error,
                tenantId,
                unitId,
                conversationId
            });
            next(error);
        }
    }
}
