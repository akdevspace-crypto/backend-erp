import { TriggerEngine } from '../../core/TriggerEngine.js';

export class EnquiryAutomation {
    static async onEnquiryCreated(tenantId: string, unitId: string, enquiryId: string, payload: any, source: string = 'internal', channelId?: string) {
        // Triggers Lead Scoring -> Priority -> Task Creation logic
        return await TriggerEngine.processEvent(
            tenantId,
            unitId,
            'enquiry',
            'enquiry_created',
            enquiryId,
            payload,
            source,
            channelId
        );
    }
}
