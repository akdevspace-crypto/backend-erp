import { emitRealtimeEvent, emitRoomEvent, emitCallsEvent } from "../../shared/services/socket.js";
import { getSharedRedisConnection } from "../../shared/utils/redisConnection.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const ACTIVE_CALL_TTL_SECONDS = 60 * 60 * 6;

let redis;

const getRedis = () => {
    if (!redis) {
        redis = getSharedRedisConnection("call-realtime-service", {
            redisUrl: REDIS_URL,
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        });
    }

    return redis;
};

export const getCallRoom = (conversationId) => conversationId ? `conversation:${conversationId}` : null;
export const getAgentRoom = (agentId) => agentId ? `agent:${agentId}` : null;
export const getDepartmentRoom = (departmentId) => departmentId ? `department:${departmentId}` : null;

export const isLiveCallStatus = (status) => ["QUEUED", "RINGING", "ONGOING"].includes(String(status || "").toUpperCase());

export const buildCallRealtimePayload = (call, extra = {}) => ({
    ...call,
    ...extra,
    eventId: extra.eventId || `${call?.callSid || call?.id || "call"}:${Date.now()}`,
    emittedAt: new Date().toISOString(),
    conversationRoom: getCallRoom(call?.conversationId),
    agentRoom: getAgentRoom(call?.agentId || call?.agentEmail),
    departmentRoom: getDepartmentRoom(call?.departmentId)
});

export const upsertActiveCallState = async (call, extra = {}) => {
    if (!call?.callSid && !call?.id) return null;

    const key = `call:${call.callSid || call.id}`;
    const payload = buildCallRealtimePayload(call, extra);
    const state = {
        status: String(call.status || "").toUpperCase(),
        startedAt: call.startedAt ? new Date(call.startedAt).toISOString() : new Date().toISOString(),
        agent: call.agentName || call.agentEmail || "",
        customer: call.customerName || call.customerPhone || "",
        duration: String(call.duration || 0),
        provider: call.provider || "",
        liveTranscript: extra.liveTranscript || "",
        recordingUrl: call.recordingUrl || "",
        payload: JSON.stringify(payload)
    };

    const client = getRedis();
    await client.hset(key, state);
    await client.expire(key, ACTIVE_CALL_TTL_SECONDS);
    return payload;
};

export const removeActiveCallState = async (call) => {
    if (!call?.callSid && !call?.id) return;
    await getRedis().del(`call:${call.callSid || call.id}`);
};

export const getActiveCallState = async (callSid) => {
    if (!callSid) return null;
    const state = await getRedis().hgetall(`call:${callSid}`);
    if (!state || Object.keys(state).length === 0) return null;
    return state.payload ? JSON.parse(state.payload) : state;
};

export const listActiveCallStates = async () => {
    const client = getRedis();
    const calls = [];
    let cursor = "0";

    do {
        const result = await client.scan(cursor, "MATCH", "call:*", "COUNT", 100);
        cursor = result[0];
        const keys = result[1] || [];
        if (keys.length) {
            const states = await Promise.all(keys.map((key) => client.hgetall(key)));
            states.forEach((state) => {
                if (!state || Object.keys(state).length === 0) return;
                calls.push(state.payload ? JSON.parse(state.payload) : state);
            });
        }
    } while (cursor !== "0");

    return calls;
};

export const emitCallRealtimeEvent = async (eventName, call, extra = {}) => {
    if (!call) return;

    const payload = isLiveCallStatus(call.status)
        ? await upsertActiveCallState(call, extra)
        : buildCallRealtimePayload(call, extra);

    if (!isLiveCallStatus(call.status)) {
        await removeActiveCallState(call);
    }

    const conversationRoom = getCallRoom(call.conversationId);
    const agentRoom = getAgentRoom(call.agentId || call.agentEmail);
    const departmentRoom = getDepartmentRoom(call.departmentId);

    if (conversationRoom) {
        emitCallsEvent(conversationRoom, eventName, payload);
        emitRoomEvent(call.conversationId, eventName, payload);
    }
    if (agentRoom) emitCallsEvent(agentRoom, eventName, payload);
    if (departmentRoom) emitCallsEvent(departmentRoom, eventName, payload);

    emitCallsEvent(null, eventName, payload);
    emitRealtimeEvent(eventName, payload);

    if (isLiveCallStatus(call.status)) {
        if (conversationRoom) emitCallsEvent(conversationRoom, "call:active", payload);
        emitCallsEvent(null, "call:active", payload);
        emitRealtimeEvent("call:active", payload);
    }
};
