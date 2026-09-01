import { Queue } from "bullmq";
import { getContext } from "../../shared/utils/context.js";
import { getSharedRedisConnection } from "../../shared/utils/redisConnection.js";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const AUTOMATION_QUEUE_ENABLED = String(process.env.AUTOMATION_QUEUE_ENABLED || "false").trim().toLowerCase() === "true";

let connection: any;
let queueInstance: Queue | null = null;
let disabledUntil = 0;
let disabledLogShown = false;

const getConnection = () => {
    if (!connection) {
        connection = getSharedRedisConnection("automation-queue", {
            redisUrl: REDIS_URL,
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        });
    }
    return connection;
};

const getQueue = () => {
    if (!AUTOMATION_QUEUE_ENABLED) return null;
    if (Date.now() < disabledUntil) return null;

    if (!queueInstance) {
        queueInstance = new Queue("automation", {
            connection: getConnection()
        } as any);
    }

    return queueInstance;
};

export const queue = {
    add: async (...args: Parameters<Queue["add"]>) => {
        const activeQueue = getQueue();
        if (!activeQueue) return null;
        return activeQueue.add(...args);
    }
};

export const addAutomationJob = async (data: any) => {
    if (!AUTOMATION_QUEUE_ENABLED) {
        if (!disabledLogShown) {
            disabledLogShown = true;
            console.warn("[AUTOMATION] Queue disabled. Set AUTOMATION_QUEUE_ENABLED=true only when Redis has enough client capacity.");
        }
        return null;
    }

    const context = getContext();

    try {
        return await queue.add("process_event", {
            ...data,
            tenantId: data.tenantId || context?.tenantId,
            unitId: data.unitId || context?.unitId,
            userId: data.userId || context?.userId,
            _context: context
        } as any);
    } catch (error: any) {
        disabledUntil = Date.now() + 60_000;
        console.warn("[AUTOMATION] Redis queue unavailable. Skipping automation jobs for 60 seconds.", error?.message || error);
        return null;
    }
};
