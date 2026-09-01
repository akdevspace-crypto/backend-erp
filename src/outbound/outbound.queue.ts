import { Queue } from "bullmq";
import dotenv from "dotenv";
import { getOutboundQueueEnv } from "../config/omnichannel.js";
import { logger } from "../shared/services/logger.js";
import { getSharedRedisConnection } from "../shared/utils/redisConnection.js";

dotenv.config();

const queueLogger = logger.child({ scope: "outbound-queue" });

let outboundQueue: Queue | null = null;

export const getOutboundQueueConnection = () => {
    const env = getOutboundQueueEnv();
    return getSharedRedisConnection("outbound-queue", {
        maxRetriesPerRequest: null,
        redisUrl: env.REDIS_URL
    } as any);
};

export const getOutboundQueue = () => {
    if (!outboundQueue) {
        const env = getOutboundQueueEnv();

        outboundQueue = new Queue("outbound", {
            connection: getOutboundQueueConnection(),
            defaultJobOptions: {
                attempts: env.OUTBOUND_QUEUE_ATTEMPTS,
                backoff: {
                    type: "exponential",
                    delay: env.OUTBOUND_QUEUE_BACKOFF_MS
                },
                removeOnComplete: {
                    count: env.OUTBOUND_REMOVE_ON_COMPLETE_COUNT
                },
                removeOnFail: {
                    count: env.OUTBOUND_REMOVE_ON_FAIL_COUNT
                }
            }
        });
    }

    return outboundQueue;
};
