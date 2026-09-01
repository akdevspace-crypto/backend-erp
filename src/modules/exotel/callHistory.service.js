import { prisma } from "../../app/prisma.js";
import { logger } from "../../shared/services/logger.js";
import { emitRealtimeEvent, emitRoomEvent } from "../../shared/services/socket.js";
import { emitCallRealtimeEvent } from "../calls/realtime.service.js";
import { addAnalyticsEventJob, addCallEventJob } from "../calls/queues.js";

const callLogger = logger.child({ scope: "call-history-service" });

const normalizeText = (value) => String(value || "").trim();

export const normalizeCallStatus = (value) => {
    const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "-");

    switch (normalized) {
        case "ringing":
            return "RINGING";
        case "queued":
            return "QUEUED";
        case "in-progress":
        case "inprogress":
        case "connected":
        case "answered":
        case "ongoing":
            return "ONGOING";
        case "completed":
        case "ended":
            return "COMPLETED";
        case "no-answer":
        case "noanswer":
        case "missed":
            return "MISSED";
        case "rejected":
            return "REJECTED";
        case "canceled":
        case "cancelled":
            return "CANCELED";
        case "busy":
            return "BUSY";
        case "failed":
            return "FAILED";
        default:
            return (normalized || "ringing").toUpperCase();
    }
};

export const isTerminalCallStatus = (value) => ["COMPLETED", "MISSED", "FAILED", "BUSY", "REJECTED", "CANCELED"].includes(normalizeCallStatus(value));

const parseDate = (value, fallback) => {
    const raw = normalizeText(value);
    if (!raw) return fallback;

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const buildWhere = ({ tenantId, unitId, conversationId, customerPhone, status, direction, provider, from, to }) => {
    const where = {};

    if (tenantId) where.tenantId = tenantId;
    if (unitId && unitId !== "ALL") where.unitId = unitId;
    if (conversationId && customerPhone) {
        where.OR = [
            { conversationId },
            { customerPhone: { contains: customerPhone } }
        ];
    } else if (conversationId) {
        where.conversationId = conversationId;
    } else if (customerPhone) {
        where.customerPhone = { contains: customerPhone };
    }
    if (status && status !== "ALL") where.status = normalizeCallStatus(status);
    if (direction && direction !== "ALL") where.direction = String(direction).toLowerCase();
    if (provider && provider !== "ALL") where.provider = String(provider).toLowerCase();
    if (from || to) {
        where.startedAt = {};
        if (from) where.startedAt.gte = parseDate(from, undefined);
        if (to) where.startedAt.lte = parseDate(to, undefined);
    }

    return where;
};

const emitCallHistoryEvent = async (eventName, call) => {
    if (!call) return;

    const payload = {
        ...call,
        tenantId: call.tenantId,
        unitId: call.unitId,
        conversationId: call.conversationId,
        callHistory: call,
        callSid: call.callSid,
        status: call.status,
        direction: call.direction,
        provider: call.provider,
        customerPhone: call.customerPhone,
        startedAt: call.startedAt,
        endedAt: call.endedAt
    };

    if (call.conversationId) {
        emitRoomEvent(call.conversationId, eventName, payload);
    }
    emitRoomEvent("global:calls", eventName, payload);
    emitRealtimeEvent(eventName, payload);
    await emitCallRealtimeEvent(eventName, call, { eventId: payload.eventId });
    addCallEventJob({ eventName, call }).catch((error) => callLogger.error("Failed to queue call event", { error }));

    const legacyEventName = eventName === "call:new" ? "call:started" : eventName === "call:update" && isTerminalCallStatus(call.status) ? "call:ended" : null;
    if (legacyEventName) {
        if (call.conversationId) emitRoomEvent(call.conversationId, legacyEventName, payload);
        emitRoomEvent("global:calls", legacyEventName, payload);
        emitRealtimeEvent(legacyEventName, payload);
    }

    const analytics = await CallHistoryService.getAnalytics(call.tenantId, call.unitId, {
        conversationId: call.conversationId || undefined,
        customerPhone: call.customerPhone || undefined
    });
    const analyticsPayload = {
        tenantId: call.tenantId,
        unitId: call.unitId,
        conversationId: call.conversationId,
        customerPhone: call.customerPhone,
        analytics
    };

    if (call.conversationId) emitRoomEvent(call.conversationId, "call:analytics", analyticsPayload);
    emitRoomEvent("global:calls", "call:analytics", analyticsPayload);
    emitRealtimeEvent("call:analytics", analyticsPayload);
    await emitCallRealtimeEvent("call:analytics", call, { analytics });
    addAnalyticsEventJob(analyticsPayload).catch((error) => callLogger.error("Failed to queue call analytics event", { error }));
};

export class CallHistoryService {
    static async logCallEvent(payload) {
        try {
            const status = normalizeCallStatus(payload.status);
            const callSid = normalizeText(payload.callSid) || null;
            if (!callSid && !payload.conversationId && !payload.customerPhone) return null;

            const endedAt = payload.endedAt ?? (isTerminalCallStatus(status) ? new Date() : undefined);
            const createData = {
                tenantId: payload.tenantId,
                unitId: payload.unitId,
                conversationId: payload.conversationId,
                customerPhone: payload.customerPhone,
                customerName: payload.customerName,
                agentName: payload.agentName,
                agentEmail: payload.agentEmail,
                provider: String(payload.provider || "exotel").toLowerCase(),
                direction: String(payload.direction || "inbound").toLowerCase(),
                status: status || "RINGING",
                duration: payload.duration || 0,
                recordingUrl: payload.recordingUrl,
                callSid,
                startedAt: parseDate(payload.startedAt, new Date()),
                endedAt
            };

            if (callSid) {
                const existing = await prisma.callHistory.findUnique({ where: { callSid } });
                const saved = await prisma.callHistory.upsert({
                    where: { callSid },
                    create: createData,
                    update: {
                        status: status || undefined,
                        endedAt,
                        duration: payload.duration,
                        recordingUrl: payload.recordingUrl,
                        customerName: payload.customerName,
                        customerPhone: payload.customerPhone,
                        agentName: payload.agentName,
                        agentEmail: payload.agentEmail,
                        conversationId: payload.conversationId,
                    }
                });

                emitCallHistoryEvent(existing ? "call:update" : "call:new", saved).catch((error) => {
                    callLogger.error("Failed to emit call realtime event", { error, callSid });
                });
                return saved;
            }

            const created = await prisma.callHistory.create({
                data: createData
            });

            emitCallHistoryEvent("call:new", created).catch((error) => {
                callLogger.error("Failed to emit call realtime event", { error });
            });
            return created;
        } catch (error) {
            callLogger.error("Failed to log call event to CallHistory", { error, payload });
            return null;
        }
    }

    static async listCalls({ tenantId, unitId, conversationId, customerPhone, status, direction, provider, from, to, limit = 100 }) {
        const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);

        return prisma.callHistory.findMany({
            where: buildWhere({ tenantId, unitId, conversationId, customerPhone, status, direction, provider, from, to }),
            orderBy: { startedAt: "desc" },
            take: safeLimit
        });
    }

    static async getCustomerContext({ tenantId, unitId, conversationId, customerPhone }) {
        const where = buildWhere({ tenantId, unitId, conversationId, customerPhone });
        const [calls, aggregate] = await Promise.all([
            prisma.callHistory.findMany({ where, orderBy: { startedAt: "desc" }, take: 25 }),
            prisma.callHistory.aggregate({
                where,
                _count: { id: true },
                _avg: { duration: true }
            })
        ]);

        const lastCall = calls[0] || null;

        return {
            lastCall,
            totalCalls: aggregate._count.id,
            averageCallDuration: Math.round(aggregate._avg.duration || 0),
            lastAgent: lastCall?.agentName || lastCall?.agentEmail || null,
            callStatus: lastCall?.status || "none",
            recentCalls: calls
        };
    }

    static async getAnalytics(tenantId, unitId, filters = {}) {
        const where = buildWhere({ tenantId, unitId, ...filters });
        const stats = await prisma.callHistory.groupBy({
            by: ['status'],
            where,
            _count: {
                id: true
            },
            _avg: {
                duration: true
            }
        });

        const totalCalls = stats.reduce((acc, curr) => acc + curr._count.id, 0);
        
        const isAnswered = (status) => ['ended', 'answered', 'completed', 'connected', 'ongoing'].includes(status.toLowerCase());
        const isMissed = (status) => ['missed', 'no-answer', 'busy', 'failed', 'canceled', 'rejected'].includes(status.toLowerCase());

        const answeredCalls = stats.filter(s => isAnswered(s.status)).reduce((acc, curr) => acc + curr._count.id, 0);
        const missedCalls = stats.filter(s => isMissed(s.status)).reduce((acc, curr) => acc + curr._count.id, 0);
        
        let totalDuration = 0;
        let countWithDuration = 0;
        stats.forEach(s => {
            if (s._avg.duration) {
                totalDuration += (s._avg.duration * s._count.id);
                countWithDuration += s._count.id;
            }
        });
        const averageDuration = countWithDuration > 0 ? Math.round(totalDuration / countWithDuration) : 0;

        const agentStats = await prisma.callHistory.groupBy({
            by: ['agentEmail', 'agentName'],
            where,
            _count: { id: true },
            _avg: { duration: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10
        });

        const firstCall = await prisma.callHistory.findFirst({ where, orderBy: { startedAt: "asc" } });
        const lastCall = await prisma.callHistory.findFirst({ where, orderBy: { startedAt: "desc" } });

        return {
            totalCalls,
            answeredCalls,
            missedCalls,
            averageDuration,
            successRate: totalCalls ? Math.round((answeredCalls / totalCalls) * 100) : 0,
            responseTime: firstCall && lastCall ? Math.max(0, Math.round((new Date(lastCall.startedAt).getTime() - new Date(firstCall.startedAt).getTime()) / 1000)) : 0,
            agentPerformance: agentStats.map((agent) => ({
                agentName: agent.agentName || agent.agentEmail || "Unassigned",
                agentEmail: agent.agentEmail,
                totalCalls: agent._count.id,
                averageDuration: Math.round(agent._avg.duration || 0)
            }))
        };
    }
}
