import { Job, Worker } from "bullmq";
import { getOutboundWorkerEnv } from "../config/omnichannel.js";
import { getOutboundQueueConnection } from "./outbound.queue.js";
import { logger } from "../shared/services/logger.js";
import { getEmitter, getIO, initEmitter } from "../shared/services/socket.js";
import { NonRetryableOutboundJobError, processOutboundMessageJob } from "./outbound.processor.js";
import { runWithContext } from "../shared/utils/context.js";

const workerLogger = logger.child({ scope: "outbound-worker-runtime" });

let outboundWorker: Worker | null = null;
let emitterInitPromise: Promise<unknown> | null = null;
let cachedWorkerEnv: any = null;

const getWorkerEnv = () => {
    if (!cachedWorkerEnv) {
        cachedWorkerEnv = getOutboundWorkerEnv();
    }

    return cachedWorkerEnv;
};

const ensureEmitter = async () => {
    if (getIO() || getEmitter()) return;

    if (!emitterInitPromise) {
        emitterInitPromise = initEmitter().catch((error: unknown) => {
            workerLogger.warn("Socket emitter initialization failed for outbound worker", { error });
            emitterInitPromise = null;
        });
    }

    await emitterInitPromise;
};

const processJob = async (job: Job) => {
    const context = {
        tenantId: job.data.tenantId,
        unitId: job.data.unitId,
        userId: job.data.userId || null
    };

    return runWithContext(context, async () => {
        try {
            return await processOutboundMessageJob(job);
        } catch (error) {
            if (error instanceof NonRetryableOutboundJobError) {
                job.discard();
            }

            throw error;
        }
    });
};

export const createOutboundWorker = () => {
    if (outboundWorker) return outboundWorker;

    const env = getWorkerEnv();

    outboundWorker = new Worker("outbound", processJob, {
        connection: getOutboundQueueConnection(),
        concurrency: env.OUTBOUND_CONCURRENCY,
        limiter: {
            max: env.OUTBOUND_RATE_LIMIT_MAX,
            duration: env.OUTBOUND_RATE_LIMIT_DURATION_MS
        }
    });

    outboundWorker.on("active", (job) => {
        workerLogger.info("Outbound job started", {
            jobId: job.id,
            jobName: job.name,
            messageId: job.data?.messageId,
            conversationId: job.data?.conversationId,
            channel: job.data?.channel,
            tenantId: job.data?.tenantId,
            unitId: job.data?.unitId
        });
    });

    outboundWorker.on("completed", (job, result) => {
        workerLogger.info("Outbound job completed", {
            jobId: job.id,
            jobName: job.name,
            messageId: job.data?.messageId,
            conversationId: job.data?.conversationId,
            channel: job.data?.channel,
            tenantId: job.data?.tenantId,
            unitId: job.data?.unitId,
            status: result?.status || "COMPLETED"
        });
    });

    outboundWorker.on("failed", (job, error) => {
        const logPayload = {
            jobId: job?.id,
            jobName: job?.name,
            messageId: job?.data?.messageId,
            conversationId: job?.data?.conversationId,
            channel: job?.data?.channel,
            tenantId: job?.data?.tenantId,
            unitId: job?.data?.unitId,
            error
        };

        if (error instanceof NonRetryableOutboundJobError) {
            workerLogger.warn("Discarded non-retryable outbound job", logPayload);
            return;
        }

        workerLogger.error("Outbound job failed", logPayload);
    });

    outboundWorker.on("error", (error) => {
        workerLogger.error("Outbound worker error", { error });
    });

    return outboundWorker;
};

export const startOutboundWorker = async () => {
    const env = getWorkerEnv();
    await ensureEmitter();
    const worker = createOutboundWorker();
    await worker.waitUntilReady();

    workerLogger.info("Outbound worker ready", {
        concurrency: env.OUTBOUND_CONCURRENCY,
        rateLimitMax: env.OUTBOUND_RATE_LIMIT_MAX,
        rateLimitDurationMs: env.OUTBOUND_RATE_LIMIT_DURATION_MS
    });

    return worker;
};

export const stopOutboundWorker = async () => {
    if (!outboundWorker) return;

    await outboundWorker.close();
    workerLogger.info("Outbound worker stopped");
    outboundWorker = null;
};
