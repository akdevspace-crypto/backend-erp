import { Worker } from 'bullmq';
import { AIDecisionService } from '../../modules/ai/service.js';
import { getSharedRedisConnection } from '../utils/redisConnection.js';

const connection = getSharedRedisConnection('enquiry-worker', {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    maxRetriesPerRequest: null
});

export const enquiryWorker = new Worker('enquiry-queue', async (job) => {
    console.log(`👷 [${new Date().toISOString()}] Worker processing job ${job.id} of type ${job.name}`);

    try {
        if (job.name === 'enquiry.created') {
            const { enquiryId, tenantId, unitId, userId } = job.data;
            await AIDecisionService.processEvent(
                { tenantId, unitId, userId: userId || null },
                'ENQUIRY_CREATED',
                { enquiryId, entityId: enquiryId }
            );
        }
        console.log(`✅ [${new Date().toISOString()}] Job ${job.id} completed successfully`);
    } catch (error: any) {
        console.error(`❌ [${new Date().toISOString()}] Job ${job.id} failed:`, error.message);
        throw error; // Re-throw to trigger BullMQ retry
    }
}, {
    connection,
    settings: {
        // Correct property for BullMQ settings
        backoffStrategy: (attempts: number) => Math.pow(2, attempts) * 1000
    }
});

enquiryWorker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        console.error(`💀 DEAD LETTER QUEUE: Job ${job.id} failed permanently after ${job.attemptsMade} attempts.`);
        // Here you could move to a separate DLQ table in DB
    }
});
