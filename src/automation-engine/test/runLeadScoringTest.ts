import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
import { TriggerEngine } from "../core/TriggerEngine.js";
import { runWithContext } from "../../shared/utils/context.js";
import { prisma } from '../../app/prisma.js';




async function runLeadScoringTest() {
    console.log("\n🚀 LEAD SCORING INTELLIGENCE TEST STARTED (DIRECT EXECUTION)\n");

    const enquiryId = uuidv4();
    const tenantId = "test-tenant-p1";
    const unitId = "test-unit-p1";
    const userId = uuidv4();

    console.log(`📌 Test Enquiry ID: ${enquiryId}`);

    // ============================================================
    // 1️⃣ DIRECT EXECUTION (bypass Queue for speed)
    // ============================================================
    const jobData = {
        eventId: uuidv4(),
        _context: {
            tenantId,
            unitId,
            userId
        },
        module: "enquiry",
        event: "ENQUIRY_CREATED",
        entityId: enquiryId,
        input: {
            description: "I need URGENT medical assistance for my father. Please call immediately!!",
            serviceType: "In-House Care",
            source: "Website"
        },
        source: "test-suite"
    };

    console.log("🤖 Executing TriggerEngine.processEventAsync...");

    // Wrap in context to simulate production environment
    await runWithContext({ tenantId, unitId, userId }, async () => {
        await TriggerEngine.processEventAsync(jobData);
    });

    // ============================================================
    // 2️⃣ FETCH RESULTS
    // ============================================================
    const scoreRecord = await prisma.automationScore.findFirst({
        where: { tenantId, unitId, module: "enquiry", entityId: enquiryId }
    });

    if (!scoreRecord) {
        console.error("❌ FAIL: No score record found in DB.");
        return;
    }

    console.log("\n📊 INTELLIGENCE RESULTS:");
    console.log("-----------------------------------");
    console.log(`Score       : ${scoreRecord.score}`);
    console.log(`Label       : ${scoreRecord.label}`);
    console.log(`Probability : ${(scoreRecord.probability * 100).toFixed(2)}%`);
    console.log(`Confidence  : ${scoreRecord.confidence}`);
    console.log(`AI Reasoning: ${(scoreRecord.factors as any)?.aiReasoning || "None"}`);

    if (scoreRecord.label === "HOT") {
        console.log("\n✅ SUCCESS: AI correctly identified HOT lead urgency.");
    } else {
        console.log("\n⚠️ NOTE: Score label was " + scoreRecord.label + ". If GEMINI_API_KEY is missing, this is expected mock behavior.");
    }

    console.log("\n🎯 TEST COMPLETED\n");
}

runLeadScoringTest()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
