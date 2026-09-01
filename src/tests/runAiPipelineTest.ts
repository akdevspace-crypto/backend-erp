import { AIDecisionService } from "../modules/ai/service";
import { prisma } from "../app/prisma";

async function run() {
    const enquiry = await (prisma as any).enquiry.findFirst({
        where: {
            isDeleted: false
        },
        select: {
            id: true,
            tenantId: true,
            unitId: true
        }
    });

    if (!enquiry) {
        throw new Error("No enquiry found for pipeline test.");
    }

    const result = await AIDecisionService.processEvent({
        tenantId: enquiry.tenantId,
        unitId: enquiry.unitId,
        userId: null
    }, "ENQUIRY_CREATED", {
        enquiryId: enquiry.id,
        entityId: enquiry.id
    });

    console.log("AI pipeline test result:", result);
}

run().catch(console.error);
