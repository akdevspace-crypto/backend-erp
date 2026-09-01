import { Queue, Worker } from "bullmq";
import { logger } from "../../shared/services/logger.js";
import { getSharedRedisConnection } from "../../shared/utils/redisConnection.js";

const queueLogger = logger.child({ scope: "call-event-queues" });
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const CALL_QUEUES_ENABLED = String(process.env.CALL_QUEUES_ENABLED || "false").trim().toLowerCase() === "true";

let connection;
let workersStarted = false;
let callEventsQueue;
let analyticsEventsQueue;
let webhookEventsQueue;
let recordingSyncQueue;
let notificationEventsQueue;

const getConnection = () => {
    if (!connection) {
        connection = getSharedRedisConnection("call-event-queues", {
            redisUrl: REDIS_URL,
            maxRetriesPerRequest: null,
            enableReadyCheck: false
        });
    }

    return connection;
};

const queueOptions = {
    get connection() {
        return getConnection();
    },
    defaultJobOptions: {
        attempts: 5,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 }
    }
};

const getQueue = (name) => {
    if (!CALL_QUEUES_ENABLED) return null;

    if (name === "call-events") {
        callEventsQueue ||= new Queue("call-events", queueOptions);
        return callEventsQueue;
    }
    if (name === "analytics-events") {
        analyticsEventsQueue ||= new Queue("analytics-events", queueOptions);
        return analyticsEventsQueue;
    }
    if (name === "webhook-events") {
        webhookEventsQueue ||= new Queue("webhook-events", queueOptions);
        return webhookEventsQueue;
    }
    if (name === "recording-sync") {
        recordingSyncQueue ||= new Queue("recording-sync", queueOptions);
        return recordingSyncQueue;
    }
    if (name === "notification-events") {
        notificationEventsQueue ||= new Queue("notification-events", queueOptions);
        return notificationEventsQueue;
    }

    return null;
};

const addJob = (queueName, jobName, data) => {
    const queue = getQueue(queueName);
    if (!queue) {
        queueLogger.debug?.("Call queue disabled; skipping job", { queueName, jobName });
        return Promise.resolve({ skipped: true, queueName, jobName });
    }

    return queue.add(jobName, data);
};

export const addWebhookEventJob = (data) => addJob("webhook-events", "provider-webhook", data);
export const addCallEventJob = (data) => addJob("call-events", "call-event", data);
export const addAnalyticsEventJob = (data) => addJob("analytics-events", "analytics-event", data);
export const addRecordingSyncJob = (data) => addJob("recording-sync", "recording-sync", data);
export const addNotificationEventJob = (data) => addJob("notification-events", "notification-event", data);

export const startCallQueueWorkers = () => {
    if (!CALL_QUEUES_ENABLED) {
        queueLogger.info("Call queue workers disabled");
        return [];
    }

    if (workersStarted) return [];
    workersStarted = true;

    const connection = getConnection();
    const workers = [
        new Worker("webhook-events", async (job) => {
            if (job.data?.provider === "exotel") {
                const { ExotelController } = await import("../exotel/controller.js");
                return ExotelController.processExotelCallEvent(job.data.request);
            }
            if (job.data?.provider === "twilio") {
                const { TwilioController } = await import("../twilio/controller.js");
                return TwilioController.processCallWebhookEvent(job.data.request);
            }
            return { skipped: true };
        }, { connection, concurrency: 10 }),
        new Worker("call-events", async (job) => {
            const data = job.data;
            if (data?.event === "CALL_COMPLETED" && data?.callSid) {
                try {
                    // Lazy load AI service to avoid circular dependencies during boot
                    const { AIDecisionService } = await import("../ai/service.js");
                    const { prisma } = await import("../../app/prisma.js");

                    // Mock transcription fetch (in real life, fetch from Twilio/Exotel or Gemini direct audio)
                    const transcript = data.recordingUrl 
                        ? `(Transcript from ${data.recordingUrl}) Customer was inquiring about pricing and availability. They seemed very interested but needed it urgently.`
                        : "No audio recording available.";

                    const aiResult = await AIDecisionService.analyzeMessage(
                        { tenantId: data.tenantId, unitId: data.unitId },
                        { message: transcript }
                    );

                    const aiSummary = {
                        summary: aiResult.summary,
                        sentiment: aiResult.sentiment,
                        urgency: aiResult.urgency,
                        intent: aiResult.intent,
                        recommendation: aiResult.sentiment === "negative" ? "Follow up immediately with manager." : "Standard follow up protocol.",
                        generatedAt: new Date().toISOString()
                    };

                    await prisma.callHistory.update({
                        where: { callSid: data.callSid },
                        data: { aiSummary }
                    });

                    queueLogger.info("AI Intelligence generated for call", { callSid: data.callSid, summary: aiSummary.summary });
                    return aiSummary;
                } catch (error) {
                    queueLogger.error("Failed to generate AI Call Intelligence", { error, callSid: data?.callSid });
                    throw error;
                }
            }
            return data;
        }, { connection, concurrency: 10 }),
        new Worker("analytics-events", async (job) => job.data, { connection, concurrency: 5 }),
        new Worker("recording-sync", async (job) => job.data, { connection, concurrency: 3 }),
        new Worker("notification-events", async (job) => job.data, { connection, concurrency: 10 })
    ];

    workers.forEach((worker) => {
        worker.on("failed", (job, error) => queueLogger.error("Call queue job failed", { queue: worker.name, jobId: job?.id, error }));
        worker.on("error", (error) => queueLogger.error("Call queue worker error", { queue: worker.name, error }));
    });

    queueLogger.info("Call queue workers started");
    return workers;
};
