declare module "*.js";

declare module "../intelligence/services/conversation.service.js" {
    export const ConversationService: any;
}

declare module "../shared/utils/refGenerator.js" {
    export const generateRefNumber: any;
}

declare module "../config/omnichannel.js" {
    export const getOmnichannelEnv: any;
    export const validateOmnichannelEnv: any;
    export const getOmnichannelRuntimeSettings: any;
    export const getOutboundQueueEnv: any;
    export const getOutboundWorkerEnv: any;
    export const validateOutboundWorkerEnv: any;
    export const getWhatsAppChannelEnv: any;
    export const getEmailChannelEnv: any;
    export const getWhatsAppWebhookEnv: any;
    export const getEmailWebhookEnv: any;
}

declare module "../shared/services/logger.js" {
    export const logger: any;
    export const createLoggerWithBindings: any;
}

declare module "../outbound/outbound.processor.js" {
    export const processOutboundMessageJob: any;
    export const NonRetryableOutboundJobError: any;
}

declare module "../modules/webhooks/controller.js" {
    export const verifyHmacSignature: any;
    export const extractWhatsAppEntries: any;
    export const buildEmailInbound: any;
    export const WebhookController: any;
}
