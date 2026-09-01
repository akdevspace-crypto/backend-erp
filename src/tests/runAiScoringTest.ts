import { AIDecisionService } from "../modules/ai/service";

async function run() {
    const result = await AIDecisionService.scoreLead({
        tenantId: "test-tenant",
        unitId: "test-unit"
    }, {
        contactAvailable: true,
        serviceId: null,
        cityId: null,
        source: "website",
        channel: "whatsapp",
        description: "Need home care urgently for my father."
    });

    console.log("AI scoring test result:", result);
}

run().catch(console.error);
