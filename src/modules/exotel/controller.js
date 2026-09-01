import { prisma } from "../../app/prisma.js";
import { ConversationService } from "../../intelligence/services/conversation.service.js";
import { ensureChannelIdentity, IdentityResolver } from "../../services/identityResolver.js";
import { emitRealtimeEvent } from "../../shared/services/socket.js";
import { logger } from "../../shared/services/logger.js";
import { success } from "../../shared/utils/response.js";
import {
    makeOutboundExotelCall,
    normalizeExotelCallStatus,
    resolveExotelStatusCallbackUrl
} from "./service.js";
import { CallHistoryService, isTerminalCallStatus, normalizeCallStatus } from "./callHistory.service.js";
import { addWebhookEventJob } from "../calls/queues.js";
import { listActiveCallStates } from "../calls/realtime.service.js";

const exotelLogger = logger.child({ scope: "exotel-controller" });

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
        throw new Error("tenantId and unitId are required for Exotel webhooks");
    }

    return { tenantId, unitId };
};

const buildIncomingCallBody = (from) => `Incoming call from ${from}`;
const buildOutgoingCallBody = (to) => `Outgoing call to ${to}`;
const buildCallStatusBody = ({ direction, phone, status, duration }) => {
    const normalizedDirection = String(direction || "").toLowerCase() === "outbound" ? "Outgoing" : "Incoming";
    const normalizedStatus = normalizeCallStatus(status);
    const suffix = duration ? ` (${duration}s)` : "";

    if (normalizedStatus === "MISSED") return `${normalizedDirection} missed call from ${phone}`;
    if (normalizedStatus === "BUSY") return `${normalizedDirection} call busy${suffix}`;
    if (normalizedStatus === "FAILED") return `${normalizedDirection} call failed${suffix}`;
    if (isTerminalCallStatus(normalizedStatus)) return `${normalizedDirection} call ended${suffix}`;
    if (normalizedStatus === "ONGOING") return `${normalizedDirection} call connected${suffix}`;
    return `${normalizedDirection} call ${normalizedStatus || "ringing"}`;
};

const buildCallEventPayload = ({
    tenantId,
    unitId,
    conversationId,
    message,
    callSid,
    from,
    to,
    direction,
    status,
    initiatedByUserId
}) => ({
    tenantId,
    unitId,
    conversationId,
    messageId: message?.id || null,
    callSid: callSid || null,
    from: from || null,
    to: to || null,
    direction,
    status,
    initiatedByUserId: initiatedByUserId || null,
    message: message || null
});

const isExotelWebhookAuthorized = (req) => {
    const secret = String(process.env.EXOTEL_WEBHOOK_SECRET || "").trim();
    if (!secret) return true;

    const signature = String(getHeader(req, "x-exotel-signature") || getHeader(req, "x-webhook-signature") || "").trim();
    const token = String(req.query?.token || req.body?.token || getHeader(req, "x-webhook-token") || "").trim();
    return signature === secret || token === secret;
};

export class ExotelController {
    static async incomingCall(req, res, next) {
        try {
            const { tenantId, unitId } = resolveWebhookContext(req);
            const from = IdentityResolver.normalizeExternalUserId("call", String(getBodyValue(req.body, ["From", "from"])));
            const to = String(getBodyValue(req.body, ["To", "to"]) || process.env.EXOTEL_CALLER_ID || "").trim();
            const callSid = String(getBodyValue(req.body, ["CallSid", "callSid", "callsid"]) || "").trim() || null;
            const status = normalizeExotelCallStatus(getBodyValue(req.body, ["CallStatus", "Status", "status"]) || "ringing");

            if (!from) {
                return res.status(400).json({ success: false, message: "Caller number is required" });
            }

            const resolved = await IdentityResolver.resolveConversation({
                externalUserId: from,
                channel: "call",
                tenantId,
                unitId,
                metadata: {
                    provider: "exotel",
                    direction: "inbound",
                    callSid,
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
                channel: "call",
                direction: "INBOUND",
                body: buildIncomingCallBody(resolved.externalUserId),
                sender: resolved.externalUserId,
                recipient: to || null,
                externalUserId: resolved.externalUserId,
                externalMessageId: callSid,
                status,
                deliveryStatus: status,
                metadata: {
                    provider: "exotel",
                    direction: "inbound",
                    callSid,
                    from: resolved.externalUserId,
                    to,
                    providerStatus: req.body
                },
                rawPayload: req.body
            });

            await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                conversationId: resolved.conversationId,
                customerPhone: resolved.externalUserId,
                provider: "exotel",
                direction: "inbound",
                status,
                callSid,
                startedAt: new Date()
            });

            const eventPayload = buildCallEventPayload({
                tenantId,
                unitId,
                conversationId: resolved.conversationId,
                message: result.message,
                callSid,
                from: resolved.externalUserId,
                to,
                direction: "INBOUND",
                status
            });

            emitRealtimeEvent("INCOMING_CALL", eventPayload);
            emitRealtimeEvent("CALL_STATUS", eventPayload);

            const responseMessage = String(process.env.EXOTEL_INBOUND_RESPONSE_MESSAGE || "Connecting your call.").trim();
            res.type("text/xml");
            return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${responseMessage}</Say></Response>`);
        } catch (error) {
            exotelLogger.error("Incoming Exotel call webhook failed", { error, payload: req.body });
            next(error);
        }
    }

    static async callStatus(req, res, next) {
        try {
            console.log("📞 [EXOTEL CALLBACK] Payload:", JSON.stringify(req.body, null, 2));
            const { tenantId, unitId } = resolveWebhookContext(req);
            const callSid = String(getBodyValue(req.body, ["CallSid", "callSid", "callsid"])).trim();
            const from = IdentityResolver.normalizeExternalUserId("call", String(getBodyValue(req.body, ["From", "from"])));
            const to = IdentityResolver.normalizeExternalUserId("call", String(getBodyValue(req.body, ["To", "to"])));
            const providerStatus = getBodyValue(req.body, ["CallStatus", "Status", "status"]) || "completed";
            const status = normalizeExotelCallStatus(providerStatus);
            const historyStatus = normalizeCallStatus(status);
            const recordingUrl = String(getBodyValue(req.body, ["RecordingUrl", "recordingUrl"]) || "").trim() || null;
            const duration = parseInt(getBodyValue(req.body, ["Duration", "duration"]) || "0", 10) || 0;

            console.log(`📞 [EXOTEL CALLBACK] Processing: SID=${callSid}, Status=${providerStatus} -> Normalized=${historyStatus}`);

            if (!callSid) {
                console.error("❌ [EXOTEL CALLBACK] Missing CallSid");
                return res.status(400).json({ success: false, message: "CallSid is required" });
            }

            const updatedMessage = await ConversationService.updateMessageStatusByExternalId({
                tenantId,
                unitId,
                channel: "call",
                externalMessageId: callSid,
                status,
                deliveryStatus: status,
                metadata: {
                    provider: "exotel",
                    callSid,
                    callStatus: status,
                    duration,
                    recordingUrl,
                    providerStatus: req.body
                }
            });

            if (!updatedMessage) {
                console.warn(`⚠️ [EXOTEL CALLBACK] Unknown call SID: ${callSid}`);
                exotelLogger.warn("Received Exotel call status for unknown call", {
                    tenantId,
                    unitId,
                    callSid,
                    status
                });
            }

            const saved = await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                conversationId: updatedMessage?.conversationId,
                customerPhone: String(getBodyValue(req.body, ["Direction", "direction"]) || "").trim().toLowerCase() === "inbound" ? from : to,
                provider: "exotel",
                status: historyStatus,
                duration,
                recordingUrl,
                callSid,
                endedAt: isTerminalCallStatus(historyStatus) ? new Date() : undefined
            });

            if (saved) {
                console.log(`✅ [EXOTEL CALLBACK] CallHistory updated: SID=${callSid}, Status=${historyStatus}`);
            }

            emitRealtimeEvent("CALL_STATUS", buildCallEventPayload({
                tenantId,
                unitId,
                conversationId: updatedMessage?.conversationId || null,
                message: updatedMessage,
                callSid,
                from,
                to,
                direction: String(getBodyValue(req.body, ["Direction", "direction"]) || "").trim().toUpperCase() || null,
                status
            }));

            return res.status(200).json({ success: true });
        } catch (error) {
            console.error("❌ [EXOTEL CALLBACK] ERROR:", error);
            exotelLogger.error("Exotel call status webhook failed", { error, payload: req.body });
            next(error);
        }
    }

    static async exotelCallWebhook(req, res) {
        if (!isExotelWebhookAuthorized(req)) {
            return res.sendStatus(401);
        }

        const webhookRequest = {
            body: req.body,
            query: req.query,
            headers: req.headers
        };

        res.sendStatus(200);

        addWebhookEventJob({ provider: "exotel", request: webhookRequest }).catch((queueError) => {
            exotelLogger.error("Failed to queue Exotel webhook; falling back to inline async processing", { error: queueError });
            setImmediate(() => {
                ExotelController.processExotelCallEvent(webhookRequest).catch((error) => {
                    exotelLogger.error("Async Exotel call webhook processing failed", { error, payload: webhookRequest.body });
                });
            });
        });
    }

    static async processExotelCallEvent(req) {
        try {
            const { tenantId, unitId } = resolveWebhookContext(req);
            const callSid = String(getBodyValue(req.body, ["CallSid", "callSid", "callsid"])).trim();
            const rawDirection = String(getBodyValue(req.body, ["Direction", "direction"]) || "").trim().toLowerCase();
            const from = IdentityResolver.normalizeExternalUserId("call", String(getBodyValue(req.body, ["From", "from"])));
            const to = IdentityResolver.normalizeExternalUserId("call", String(getBodyValue(req.body, ["To", "to"])));
            const direction = rawDirection.includes("out") ? "outbound" : "inbound";
            const customerPhone = direction === "outbound" ? to : from;
            const agentPhone = direction === "outbound" ? from : to;
            const providerStatus = getBodyValue(req.body, ["CallStatus", "Status", "status"]) || "ringing";
            const historyStatus = normalizeCallStatus(providerStatus);
            const recordingUrl = String(getBodyValue(req.body, ["RecordingUrl", "recordingUrl"]) || "").trim() || null;
            const duration = parseInt(getBodyValue(req.body, ["Duration", "duration"]) || "0", 10) || 0;
            const startedAt = getBodyValue(req.body, ["StartTime", "startTime", "StartedAt", "startedAt"]);
            const endedAt = getBodyValue(req.body, ["EndTime", "endTime", "EndedAt", "endedAt"]);

            if (!callSid) {
                exotelLogger.warn("Ignoring Exotel call webhook without CallSid", { payload: req.body });
                return;
            }

            if (!customerPhone) {
                exotelLogger.warn("Ignoring Exotel call webhook without customer phone", { payload: req.body });
                return;
            }

            await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                customerPhone,
                provider: "exotel",
                direction,
                status: historyStatus,
                duration,
                recordingUrl,
                callSid,
                startedAt,
                endedAt: endedAt || (isTerminalCallStatus(historyStatus) ? new Date() : undefined)
            });

            const existingMessage = await ConversationService.updateMessageStatusByExternalId({
                tenantId,
                unitId,
                channel: "call",
                externalMessageId: callSid,
                status: providerStatus,
                deliveryStatus: providerStatus,
                metadata: {
                    provider: "exotel",
                    callSid,
                    callStatus: historyStatus,
                    duration,
                    recordingUrl,
                    providerStatus: req.body
                }
            });

            let message = existingMessage;
            let conversationId = existingMessage?.conversationId || null;
            let resolved = null;

            if (!message) {
                resolved = await IdentityResolver.resolveConversation({
                    externalUserId: customerPhone,
                    channel: "call",
                    tenantId,
                    unitId,
                    metadata: {
                        provider: "exotel",
                        direction,
                        callSid,
                        agentPhone
                    }
                });

                conversationId = resolved.conversationId;

                const result = await ConversationService.appendMessage({
                    tenantId,
                    unitId,
                    conversationId,
                    entityType: "CLIENT",
                    entityId: resolved.clientId,
                    clientId: resolved.clientId,
                    channel: "call",
                    direction: direction === "outbound" ? "OUTBOUND" : "INBOUND",
                    body: buildCallStatusBody({ direction, phone: customerPhone, status: historyStatus, duration }),
                    sender: direction === "outbound" ? agentPhone : customerPhone,
                    recipient: direction === "outbound" ? customerPhone : agentPhone,
                    externalUserId: customerPhone,
                    externalMessageId: callSid,
                    status: providerStatus,
                    deliveryStatus: providerStatus,
                    metadata: {
                        provider: "exotel",
                        direction,
                        callSid,
                        duration,
                        recordingUrl,
                        from,
                        to,
                        providerStatus: req.body
                    },
                    rawPayload: req.body
                });

                message = result.message;
            }

            const callHistory = await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                conversationId,
                customerPhone,
                customerName: resolved?.client?.name,
                provider: "exotel",
                direction,
                status: historyStatus,
                duration,
                recordingUrl,
                callSid,
                startedAt,
                endedAt: endedAt || (isTerminalCallStatus(historyStatus) ? new Date() : undefined)
            });

            const eventPayload = buildCallEventPayload({
                tenantId,
                unitId,
                conversationId,
                message,
                callSid,
                from,
                to,
                direction: direction.toUpperCase(),
                status: historyStatus
            });

            emitRealtimeEvent("CALL_STATUS", { ...eventPayload, callHistory });
        } catch (error) {
            exotelLogger.error("Exotel call webhook failed", { error, payload: req.body });
        }
    }

    static async outboundCall(req, res, next) {
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

            const resolvedRecipient = await IdentityResolver.resolveExternalUserIdForConversation({
                conversationId,
                channel: "call",
                tenantId,
                unitId
            });

            const customerPhone = IdentityResolver.normalizeExternalUserId(
                "call",
                String(req.body?.to || req.body?.phone || resolvedRecipient || "")
            );
            const agentPhone = String(req.body?.agentPhone || req.user.mobile || "").trim();

            if (!customerPhone) {
                return res.status(400).json({ success: false, message: "Customer phone number is required for outbound calling" });
            }

            if (!agentPhone) {
                return res.status(400).json({ success: false, message: "Your mobile number is not available. Update your profile before placing calls." });
            }

            const messageBody = String(req.body?.body || buildOutgoingCallBody(customerPhone)).trim();
            const initialMessage = await ConversationService.appendMessage({
                tenantId,
                unitId,
                conversationId: conversation.id,
                entityType: conversation.entityType,
                entityId: conversation.entityId,
                clientId: conversation.clientId,
                enquiryId: conversation.enquiryId,
                channel: "call",
                direction: "OUTBOUND",
                body: messageBody,
                sender: req.user.email || req.user.id,
                recipient: customerPhone,
                externalUserId: customerPhone,
                status: "QUEUED",
                deliveryStatus: "QUEUED",
                metadata: {
                    provider: "exotel",
                    direction: "outbound",
                    agentPhone,
                    initiatedByUserId: req.user.id,
                    initiatedBy: req.user.email || req.user.id
                }
            });

            if (conversation.clientId) {
                await ensureChannelIdentity({
                    externalUserId: customerPhone,
                    channel: "call",
                    tenantId,
                    unitId,
                    clientId: conversation.clientId,
                    conversationId: conversation.id
                });
            }

            // Immediately create CallHistory row (status QUEUED) before calling provider
            const initialCallHistory = await CallHistoryService.logCallEvent({
                tenantId,
                unitId,
                conversationId: conversation.id,
                customerPhone,
                agentName: req.user.firstName || req.user.email,
                agentEmail: req.user.email,
                provider: "exotel",
                direction: "outbound",
                status: "QUEUED",
                startedAt: new Date()
            });

            try {
                const statusCallbackUrl = resolveExotelStatusCallbackUrl(req.body?.statusCallbackUrl);
                const exotelCall = await makeOutboundExotelCall({
                    agentPhone,
                    customerPhone,
                    statusCallback: statusCallbackUrl || undefined
                });

                // Attach CallSid to the initial history row so webhooks can find it
                if (initialCallHistory && exotelCall.callSid) {
                    try {
                        await prisma.callHistory.update({
                            where: { id: initialCallHistory.id },
                            data: { callSid: exotelCall.callSid }
                        });
                    } catch (updateError) {
                        exotelLogger.error("Failed to update initial call history with CallSid", { 
                            error: updateError, 
                            id: initialCallHistory.id, 
                            callSid: exotelCall.callSid 
                        });
                    }
                }

                const updatedMessage = await ConversationService.updateMessageStatus({
                    messageId: initialMessage.message.id,
                    tenantId,
                    unitId,
                    status: exotelCall.status || "IN_PROGRESS",
                    deliveryStatus: exotelCall.status || "IN_PROGRESS",
                    externalMessageId: exotelCall.callSid || undefined,
                    sentAt: new Date(),
                    metadata: {
                        provider: "exotel",
                        direction: "outbound",
                        agentPhone,
                        statusCallbackUrl: statusCallbackUrl || null,
                        providerResponse: {
                            callSid: exotelCall.callSid,
                            status: exotelCall.status,
                            from: exotelCall.from,
                            to: exotelCall.to
                        }
                    }
                });

                // This will now update the existing row because callSid is attached
                await CallHistoryService.logCallEvent({
                    tenantId,
                    unitId,
                    conversationId: conversation.id,
                    customerPhone,
                    agentName: req.user.firstName || req.user.email,
                    agentEmail: req.user.email,
                    provider: "exotel",
                    direction: "outbound",
                    status: normalizeCallStatus(exotelCall.status || "IN_PROGRESS"),
                    callSid: exotelCall.callSid,
                    startedAt: new Date()
                });

                emitRealtimeEvent("OUTGOING_CALL", buildCallEventPayload({
                    tenantId,
                    unitId,
                    conversationId: conversation.id,
                    message: updatedMessage,
                    callSid: exotelCall.callSid,
                    from: agentPhone,
                    to: customerPhone,
                    direction: "OUTBOUND",
                    status: updatedMessage?.deliveryStatus || updatedMessage?.status || exotelCall.status || "IN_PROGRESS",
                    initiatedByUserId: req.user.id
                }));

                return success(res, {
                    conversationId: conversation.id,
                    callSid: exotelCall.callSid,
                    status: updatedMessage?.deliveryStatus || updatedMessage?.status || exotelCall.status || "IN_PROGRESS",
                    message: updatedMessage
                }, { message: "Call initiated" });
            } catch (callError) {
                await ConversationService.updateMessageStatus({
                    messageId: initialMessage.message.id,
                    tenantId,
                    unitId,
                    status: "FAILED",
                    deliveryStatus: "FAILED",
                    metadata: {
                        provider: "exotel",
                        errorMessage: callError instanceof Error ? callError.message : String(callError)
                    }
                }).catch(() => undefined);

                throw callError;
            }
        } catch (error) {
            exotelLogger.error("Failed to place outbound Exotel call", {
                error,
                tenantId,
                unitId,
                conversationId
            });
            next(error);
        }
    }

    static async callAnalytics(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const analytics = await CallHistoryService.getAnalytics(tenantId, unitId, req.query);
            return success(res, analytics);
        } catch (error) {
            exotelLogger.error("Failed to fetch call analytics", { error });
            next(error);
        }
    }

    static async globalCallAnalytics(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const analytics = await CallHistoryService.getAnalytics(tenantId, unitId, req.query);
            return success(res, analytics);
        } catch (error) {
            exotelLogger.error("Failed to fetch global call analytics", { error });
            next(error);
        }
    }

    static async callHistory(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const calls = await CallHistoryService.listCalls({
                tenantId,
                unitId,
                ...req.query,
                customerPhone: req.query.customerPhone || req.query.phone
            });
            return success(res, calls);
        } catch (error) {
            exotelLogger.error("Failed to fetch call history", { error });
            next(error);
        }
    }

    static async globalCallHistory(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const calls = await CallHistoryService.listCalls({
                tenantId,
                unitId,
                status: req.query.status,
                direction: req.query.direction,
                provider: req.query.provider,
                from: req.query.from,
                to: req.query.to,
                limit: req.query.limit || 200
            });
            return success(res, calls);
        } catch (error) {
            exotelLogger.error("Failed to fetch global call history", { error });
            next(error);
        }
    }

    static async callContext(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const context = await CallHistoryService.getCustomerContext({
                tenantId,
                unitId,
                conversationId: req.query.conversationId,
                customerPhone: req.query.customerPhone
            });
            return success(res, context);
        } catch (error) {
            exotelLogger.error("Failed to fetch customer call context", { error });
            next(error);
        }
    }

    static async callSync(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const lastEventId = String(req.query?.lastEventId || "").trim();
            const customerPhone = req.query.customerPhone || req.query.phone;

            const [calls, analytics, activeCalls] = await Promise.all([
                CallHistoryService.listCalls({
                    tenantId,
                    unitId,
                    conversationId: req.query.conversationId,
                    customerPhone,
                    limit: req.query.limit || 100
                }),
                CallHistoryService.getAnalytics(tenantId, unitId, {
                    conversationId: req.query.conversationId,
                    customerPhone
                }),
                listActiveCallStates()
            ]);

            return success(res, {
                calls,
                analytics,
                activeCalls: activeCalls.filter((call) => {
                    if (call.tenantId && call.tenantId !== tenantId) return false;
                    if (unitId && unitId !== "ALL" && call.unitId && call.unitId !== unitId) return false;
                    if (req.query.conversationId && call.conversationId !== req.query.conversationId) return false;
                    return true;
                }),
                lastEventId,
                syncedAt: new Date().toISOString()
            });
        } catch (error) {
            exotelLogger.error("Failed to sync call realtime state", { error });
            next(error);
        }
    }

    static async globalCallSync(req, res, next) {
        try {
            const tenantId = req.user.tenantId;
            const unitId = req.context?.unitId || req.user.unitId;
            const lastEventId = String(req.query?.lastEventId || "").trim();

            const [calls, analytics, activeCalls] = await Promise.all([
                CallHistoryService.listCalls({
                    tenantId,
                    unitId,
                    status: req.query.status,
                    direction: req.query.direction,
                    provider: req.query.provider,
                    from: req.query.from,
                    to: req.query.to,
                    limit: req.query.limit || 100
                }),
                CallHistoryService.getAnalytics(tenantId, unitId, {
                    status: req.query.status,
                    direction: req.query.direction,
                    provider: req.query.provider,
                    from: req.query.from,
                    to: req.query.to
                }),
                listActiveCallStates()
            ]);

            return success(res, {
                calls,
                analytics,
                activeCalls: activeCalls.filter((call) => {
                    if (call.tenantId && call.tenantId !== tenantId) return false;
                    if (unitId && unitId !== "ALL" && call.unitId && call.unitId !== unitId) return false;
                    return true;
                }),
                lastEventId,
                syncedAt: new Date().toISOString()
            });
        } catch (error) {
            exotelLogger.error("Failed to sync global call realtime state", { error });
            next(error);
        }
    }
}
