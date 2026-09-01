import { prisma } from "./src/app/prisma.js";
import { runWithContext } from "./src/shared/utils/context.js";

async function testHardening() {
    console.log("🔍 HARDENING TEST: Starting...");

    const context = {
        tenantId: "test-tenant-verify",
        unitId: "test-unit-verify",
        userId: "test-user-verify"
    };

    console.log("📍 Scenario 1: Write WITH context");
    await runWithContext(context, async () => {
        try {
            const score = await prisma.automationScore.create({
                data: {
                    module: "test",
                    entityId: "test-entity-" + Date.now(),
                    score: 100,
                    label: "VERIFIED",
                    factors: { test: true }
                }
            });
            console.log("✅ Success: Created score with context:", score.id);
        } catch (err) {
            console.error("❌ Unexpected Failure:", err.message);
        }
    });

    console.log("\n📍 Scenario 2: Write WITHOUT context (Should skip/warn, not crash)");
    try {
        const noContextScore = await prisma.automationScore.create({
            data: {
                module: "test-fail",
                entityId: "test-entity-fail-" + Date.now(),
                score: 0,
                label: "SHOULD_NOT_EXIST"
            }
        });
        console.log("⚠️ DB returned:", noContextScore ? "A record (Inconsistent with skip policy)" : "null/undefined (Success)");
    } catch (err) {
        console.log("✅ Caught error (Safety Gate):", err.message);
    }

    console.log("\n📍 Scenario 3: Global Error Handler Test");
    setTimeout(() => {
        console.log("🔥 Triggering unhandled promise (Should be caught by global handler in server.js/worker.ts if this was the app, but here we just test if script stays alive)");
        Promise.reject(new Error("Simulated Unhandled Rejection"));
    }, 1000);

    await new Promise(r => setTimeout(r, 2000));
    console.log("\n🏁 HARDENING TEST: Completed.");
    process.exit(0);
}

testHardening().catch(err => {
    console.error("💀 FATAL:", err);
    process.exit(1);
});
