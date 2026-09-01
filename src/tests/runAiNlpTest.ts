import { AIDecisionService } from "../modules/ai/service";

async function run() {
    const result = await AIDecisionService.analyzeMessage({
        tenantId: "test-tenant",
        unitId: "test-unit"
    }, {
        message: "This is urgent. I need a follow-up for a complaint about service quality."
    });

    console.log("AI NLP test result:", result);
}

run().catch(console.error);
