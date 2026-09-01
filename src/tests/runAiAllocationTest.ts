import { AIDecisionService } from "../modules/ai/service";

async function run() {
    const tenantId = process.env.TEST_TENANT_ID || "test-tenant";
    const unitId = process.env.TEST_UNIT_ID || "test-unit";
    const taskId = process.env.TEST_TASK_ID;

    if (!taskId) {
        throw new Error("TEST_TASK_ID is required for allocation test.");
    }

    const result = await AIDecisionService.allocate({
        tenantId,
        unitId
    }, {
        taskId,
        taskType: "SCHEDULED"
    });

    console.log("AI allocation test result:", result);
}

run().catch(console.error);
