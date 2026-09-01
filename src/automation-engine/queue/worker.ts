console.log("DEBUG: Worker script loaded");
import { Worker, Job } from "bullmq";
import { TriggerEngine } from "../core/TriggerEngine.js";
import { initEmitter } from "../../shared/services/socket.js";
import { getSharedRedisConnection } from "../../shared/utils/redisConnection.js";

console.log("DEBUG: Imports completed");
console.log("🚀 Worker booting...");

process.on("uncaughtException", (err) => {
    console.error("🔥 UNCAUGHT EXCEPTION (Worker):", err);
});

process.on("unhandledRejection", (err) => {
    console.error("🔥 UNHANDLED PROMISE (Worker):", err);
});

// ============================================================
// ✅ REDIS CONNECTION (PRODUCTION SAFE)
// ============================================================
const connection = getSharedRedisConnection("automation-worker", {
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

import { runWithContext } from "../../shared/utils/context.js";

// ============================================================
// ✅ WORKER SETUP
// ============================================================
const automationWorker = new Worker(
    "automation",
    async (job: Job) => {
        // 🔥 STEP 6: WORKER CONTEXT FIX (Do not depend on _context)
        const context = {
            tenantId: job.data.tenantId || job.data._context?.tenantId,
            unitId: job.data.unitId || job.data._context?.unitId,
            userId: job.data.userId || job.data._context?.userId || null
        };

        return runWithContext(context, async () => {
            console.log(`📍 JOB RECEIVED: ${job.id}`);
            console.log("📍 TRACE: Job Context", {
                jobId: job.id,
                tenantId: context.tenantId,
                unitId: context.unitId,
                module: job.data.module
            });
            console.log(`📍 Processing event: ${job.data.entityId || job.data.eventId}`);

            try {
                const result = await TriggerEngine.processEventAsync(job.data);
                console.log(`📍 JOB COMPLETED: ${job.id}`);
                return result;
            } catch (error) {
                console.error("⚠️ WORKER ERROR:", error);
                // Return safely to prevent worker crash
                return { success: false, error: (error as Error).message };
            }
        });
    },
    {
        connection,
        concurrency: 5,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 }
    }
);


console.log("✅ Worker initialized");

// Initialize Socket.io Emitter for real-time updates
initEmitter().catch((err: any) => console.error("❌ Socket Emitter failed:", err));

// ============================================================
// 📡 WORKER EVENTS (VERY IMPORTANT FOR DEBUG)
// ============================================================
automationWorker.on("ready", () => {
    console.log("🚀 Worker ready and listening for jobs...");
});

automationWorker.on("active", (job) => {
    console.log(`⚡ Job ${job.id} started`);
});

automationWorker.on("completed", (job, result) => {
    console.log(`✅ Job ${job.id} completed`);
    console.log("📊 Result:", result);
});

automationWorker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed`);
    console.error(err);
});

automationWorker.on("error", (err) => {
    console.error("❌ Worker error:", err);
});

// ============================================================
// 🛑 GRACEFUL SHUTDOWN (PRODUCTION)
// ============================================================
const shutdown = async () => {
    console.log("\n🛑 Shutting down worker...");

    try {
        await automationWorker.close();
        await connection.quit();

        console.log("✅ Worker closed cleanly");
        process.exit(0);
    } catch (err) {
        console.error("❌ Shutdown error:", err);
        process.exit(1);
    }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
