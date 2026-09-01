import { CopilotService } from "./src/modules/copilot/copilot.service.js";
import { prisma } from "./src/app/prisma.js";
import { runWithContext } from "./src/shared/utils/context.js";

async function testCopilot() {
    console.log("🤖 COPILOT INTEGRATION TEST: Starting...");

    const tenantId = "test-tenant-copilot";
    const unitId = "test-unit";
    const userId = "test-user";
    const context = { tenantId, unitId, userId };

    // 1. Setup mock data if needed
    console.log("📊 Ensuring test data exists...");
    await runWithContext(context, async () => {
        const enquiryCount = await prisma.enquiry.count({ where: { tenantId } });
        if (enquiryCount === 0) {
            console.log("📝 Creating test enquiry...");
            await prisma.enquiry.create({
                data: {
                    refNo: "ENQ-COPILOT-001",
                    tenantId,
                    unitId,
                    status: "NEW",
                    client: { create: { name: "Copilot Test User", tenantId } }
                }
            });
        }
    });

    // 2. Test KPI Summary Tool
    console.log("\n💬 Query 1: 'How is our performance today?' (Testing KPI Tool)");
    const res1 = await CopilotService.chat("How is our performance today?", tenantId, unitId, userId);
    console.log("🤖 Response:", res1.answer);
    console.log("🛠️ Tools Called:", res1.toolsCalled);
    if (res1.data) console.log("📦 Data Returned:", JSON.stringify(res1.data, null, 2));

    // 3. Test Lead Details Tool
    console.log("\n💬 Query 2: 'Give me details for ENQ-COPILOT-001' (Testing Lead Tool)");
    const res2 = await CopilotService.chat("Give me details for ENQ-COPILOT-001", tenantId, unitId, userId);
    console.log("🤖 Response:", res2.answer);
    console.log("🛠️ Tools Called:", res2.toolsCalled);
    if (res2.data) console.log("📦 Data Returned:", JSON.stringify(res2.data, null, 2));

    console.log("\n🏁 COPILOT INTEGRATION TEST: Completed.");
    process.exit(0);
}

testCopilot().catch(err => {
    console.error("💀 FATAL:", err);
    process.exit(1);
});
