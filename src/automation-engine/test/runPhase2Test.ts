import { PrismaClient } from "@prisma/client";
import { TriggerEngine } from "../core/TriggerEngine.js";
import { ConversionService } from "../../modules/enquiry/services/conversionService.js";
import { AnalyticsEngine } from "../core/AnalyticsEngine.js";
import { AISuggestionEngine } from "../core/AISuggestionEngine.js";
import { prisma } from '../../app/prisma.js';




async function runPhase2Test() {
    console.log("\n🚀 PHASE 2: AI INTELLIGENCE TEST STARTED\n");

    const tenantId = "test-tenant";
    const unitId = "test-unit";
    const module = "enquiry";

    // 1️⃣ FIND OR CREATE PREREQUISITES
    console.log("📌 Step 1: Finding prerequisites (Client, Service)...");
    let client = await prisma.client.findFirst();
    if (!client) {
        client = await prisma.client.create({
            data: {
                refNo: `C-${Date.now()}`,
                name: "Test AI Client",
                email: "ai@example.com",
                mobile: "1234567890",
                tenantId,
                unitId
            }
        });
    }

    let service = await prisma.clientService.findFirst();
    if (!service) {
        service = await prisma.clientService.create({
            data: {
                code: "SRV-PH2",
                name: "AI Test Service",
                category: "In-House Care",
                price: 1000,
                tenantId,
                unitId
            }
        });
    }

    // 2️⃣ CREATE A TEST ENQUIRY
    console.log("📌 Step 2: Creating a high-intent enquiry...");
    const enquiry = await (prisma.enquiry as any).create({
        data: {
            refNo: `PH2-${Date.now()}`,
            clientId: client.id,
            serviceId: service.id,
            mode: "Call",
            source: "Website",
            description: "I need urgent home care service immediately.",
            tenantId,
            unitId
        }
    });

    // 3️⃣ TRIGGER AUTOMATION
    console.log("📌 Step 3: Triggering automation engine...");
    await TriggerEngine.processEventAsync({
        tenantId,
        unitId,
        module,
        event: "ENQUIRY_CREATED",
        entityId: enquiry.id,
        input: {
            serviceType: "In-House Care",
            enquiryMode: "Call",
            comment: "urgent"
        }
    });

    // 4️⃣ MARK AS CONVERTED (Simulation)
    console.log("📌 Step 4: Simulating lead conversion...");
    await ConversionService.convertEnquiry(enquiry.id);

    // 5️⃣ RUN ANALYTICS
    console.log("📌 Step 5: Running Rule Analytics Engine...");
    await AnalyticsEngine.updateRuleAnalytics(module);

    // 6️⃣ GENERATE AI SUGGESTIONS
    console.log("📌 Step 6: Running AI Suggestion Engine...");
    await AISuggestionEngine.generateSuggestions(module);

    // 7️⃣ VERIFY RESULTS
    console.log("\n📊 VERIFYING PHASE 2 RESULTS...");

    const logs = await prisma.automationLog.findMany({ where: { entityId: enquiry.id } });
    console.log(`✅ Automation Log created: ${logs.length > 0 ? "YES" : "NO"}`);

    const tasks = await prisma.automationTask.findMany({ where: { entityId: enquiry.id } });
    console.log(`✅ Auto-Actions (Tasks) created: ${tasks.length > 0 ? "YES" : "NO"}`);

    const rules = await prisma.automationRule.findMany({ where: { module } });
    const rulesWithWeight = rules.filter((r: any) => ((r as any).performanceWeight || 0) > 0);
    console.log(`✅ Rules with Dynamic Weights: ${rulesWithWeight.length}`);

    const suggestions = await (prisma as any).automationSuggestion.findMany({ where: { module } });
    console.log(`✅ AI Suggestions generated: ${suggestions.length}`);

    console.log("\n🎯 PHASE 2 TEST COMPLETED\n");
    process.exit(0);
}

runPhase2Test().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
