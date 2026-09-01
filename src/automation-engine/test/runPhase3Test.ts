import { TriggerEngine } from "../core/TriggerEngine.js";
import { AICopilotService } from "../core/AICopilotService.js";

async function runPhase3Test() {
    console.log("\n🚀 PHASE 3: ENTERPRISE INTELLIGENCE TEST STARTED\n");

    const tenantId = "test-tenant";
    const unitId = "test-unit";

    // 💰 TEST 1: ACCOUNTS (Anomaly Detection)
    console.log("📌 Test 1: Simulating high-risk finance transaction...");
    const accountsDecision = await TriggerEngine.processEventAsync({
        tenantId,
        unitId,
        module: "accounts",
        event: "TRANSACTION_CREATED",
        entityId: "TX-9999",
        input: {
            amount: 150000,
            frequency: 10,
            vendorStatus: "Unverified"
        }
    });
    console.log(`✅ Accounts Label: ${accountsDecision.computed.label}`);

    // 👥 TEST 2: HR (Attrition Prediction)
    console.log("\n📌 Test 2: Simulating HR attrition risk signals...");
    const hrDecision = await TriggerEngine.processEventAsync({
        tenantId,
        unitId,
        module: "hr",
        event: "ATTENDANCE_LOGGED",
        entityId: "EMP-001",
        input: {
            absenteeism: 12,
            performance: 35,
            department: "Operations"
        }
    });
    console.log(`✅ HR Label: ${hrDecision.computed.label}`);

    // 🤖 TEST 3: AI COPILOT INSIGHTS
    console.log("\n📌 Test 3: Fetching AI Copilot Insights...");
    const insights = await AICopilotService.generateInsights("enquiry", tenantId);
    console.log("-----------------------------------------");
    console.log(`💡 INSIGHT: ${insights.summary}`);
    console.log("-----------------------------------------");

    console.log("\n🎯 PHASE 3 TEST COMPLETED\n");
    process.exit(0);
}

runPhase3Test().catch(err => {
    console.error("❌ TEST FAILED:", err);
    process.exit(1);
});
