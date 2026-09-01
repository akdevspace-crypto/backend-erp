import { AIDecisionService } from '../../modules/ai/service.js';
import { prisma } from '../../app/prisma.js';

export class TriggerEngine {
    static async onEnquiryCreated(enquiryId: string) {
        console.warn('Deprecated TriggerEngine.onEnquiryCreated() called. Routing to AIDecisionService.processEvent().');

        const enquiry = await (prisma as any).enquiry.findFirst({
            where: { id: enquiryId },
            select: {
                id: true,
                tenantId: true,
                unitId: true
            }
        });

        if (!enquiry) return { success: false, message: 'Enquiry not found' };

        return AIDecisionService.processEvent({
            tenantId: enquiry.tenantId,
            unitId: enquiry.unitId,
            userId: null
        }, 'ENQUIRY_CREATED', {
            enquiryId,
            entityId: enquiryId
        });
    }
}
