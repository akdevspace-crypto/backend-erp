import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { TriggerEngine } from "./src/automation-engine/core/TriggerEngine.js";
import { queue } from "./src/automation-engine/queue/queue.js";
import { prisma } from "./src/app/prisma.js";
import { runWithContext } from "./src/shared/utils/context.js";
import { v4 as uuidv4 } from "uuid";

async function runOneShot() {
    console.log("🚀 ONE-SHOT TEST STARTED");

    const REDIS_URL = "redis://default:o31U8YDLqnyZW5ZG75RSe0muzH5Gm9on@redis-12592.crce276.ap-south-1-3.ec2.cloud.redislabs.com:12592";
    const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

    // 1. Start Worker
    console.log("🛠️ Initializing Worker...");
    const worker = new Worker("automation", async (job) => {
        console.log("🔥 JOB RECEIVED:", job.id, "Data:", JSON.stringify(job.data));
        const context = {
            tenantId: job.data.tenantId,
            unitId: job.data.unitId,
            userId: job.data.userId
        };
        console.log("📍 CONTEXT EXTRACTED:", context);
        return runWithContext(context, async () => {
            console.log("🚀 STARTING TRIGGER ENGINE...");
            const result = await TriggerEngine.processEventAsync(job.data);
            console.log("✅ TRIGGER ENGINE COMPLETED");
            return result;
        });
    }, { connection });

    worker.on("ready", () => console.log("✅ Worker Ready"));
    worker.on("completed", (job) => console.log("✅ Job completed:", job.id));
    worker.on("failed", (job, err) => console.error("❌ Job failed:", job.id, err));

    // 2. Queue Job
    const entityId = uuidv4();
    const tenantId = "test-tenant-oneshot";
    const unitId = "test-unit";

    console.log("📌 Queuing job for entity:", entityId);
    await queue.add("process_event", {
        eventId: uuidv4(),
        tenantId,
        unitId,
        userId: "test-user",
        module: "enquiry",
        event: "ENQUIRY_CREATED",
        entityId,
        input: { serviceType: "In-House Care", clientComments: "Urgent" },
        source: "one-shot"
    });

    // 3. Wait
    console.log("⏳ Waiting 10s for processing...");
    await new Promise(r => setTimeout(r, 10000));

    // 4. Verify
    console.log("📊 Fetching results...");
    const score = await prisma.automationScore.findFirst({
        where: { tenantId, entityId }
    });

    if (score) {
        console.log("🎉 SUCCESS! Score found:", score.score, score.label);
    } else {
        console.error("❌ FAIL: No score found in DB.");
    }

    // 5. Cleanup
    await worker.close();
    await connection.quit();
    await prisma.$disconnect();
    process.exit(score ? 0 : 1);
}

runOneShot().catch(err => {
    console.error("💀 FATAL ERROR:", err);
    process.exit(1);
});
