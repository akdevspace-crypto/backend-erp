export interface OmniPayload {
    entityType: string;
    source: string;
    mobile?: string;
    email?: string;
    message: string;
    channelId: string;
    rawPayload: any;
    tenantId: string;
    unitId: string;
}

export class OmniParser {
    static normalize(source: string, raw: any, tenantId: string, unitId: string): OmniPayload | null {
        switch (source) {
            case 'whatsapp':
                return {
                    entityType: 'enquiry',
                    source: 'whatsapp',
                    mobile: raw?.from || raw?.contact_number,
                    message: raw?.text?.body || raw?.message || 'No message provided',
                    channelId: raw?.id || raw?.message_id || `wa-${Date.now()}`,
                    rawPayload: raw,
                    tenantId,
                    unitId
                };
            case 'email':
                return {
                    entityType: 'enquiry',
                    source: 'email',
                    email: raw?.from_email,
                    message: raw?.body || raw?.text,
                    channelId: raw?.message_id || `em-${Date.now()}`,
                    rawPayload: raw,
                    tenantId,
                    unitId
                };
            case 'call':
                return {
                    entityType: 'enquiry',
                    source: 'call',
                    mobile: raw?.caller_id,
                    message: 'Inbound Call Received',
                    channelId: raw?.call_sid || `call-${Date.now()}`,
                    rawPayload: raw,
                    tenantId,
                    unitId
                };
            default:
                return null;
        }
    }
}
