import { AIDecisionService } from "../modules/ai/service";

async function run() {
    const tenantId = process.env.TEST_TENANT_ID || "test-tenant";
    const unitId = process.env.TEST_UNIT_ID || "test-unit";

    const result = await AIDecisionService.buildForecast({
        tenantId,
        unitId
    }, {
        lookbackDays: 90,
        horizonDays: 30
    });

    console.log("AI forecast test result:", result);
}

run().catch(console.error);
