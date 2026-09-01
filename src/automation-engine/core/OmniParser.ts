export interface OmniPayload {
    tenantId: string;
    unitId: string;
    source: "whatsapp" | "email" | "call" | "web";
    externalId?: string;
    contact: {
        name?: string;
        phone?: string;
        email?: string;
    };
    message: string;
    metadata?: any;
    timestamp: string;
}

export class OmniParser {
    static normalizeWhatsApp(payload: any): OmniPayload {
        return {
            tenantId: payload.tenantId || "default",
            unitId: payload.unitId || "default",
            source: "whatsapp",
            externalId: payload.messages?.[0]?.id,
            contact: {
                phone: payload.contacts?.[0]?.wa_id || payload.from,
                name: payload.contacts?.[0]?.profile?.name || payload.name
            },
            message: payload.messages?.[0]?.text?.body || payload.text || "",
            timestamp: new Date().toISOString()
        };
    }

    static normalizeEmail(payload: any): OmniPayload {
        return {
            tenantId: payload.tenantId || "default",
            unitId: payload.unitId || "default",
            source: "email",
            externalId: payload.messageId || payload.id,
            contact: {
                email: payload.from
            },
            message: payload.body || payload.text || "",
            timestamp: new Date().toISOString()
        };
    }
}
