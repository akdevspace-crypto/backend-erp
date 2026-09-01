import { prisma } from "../../app/prisma.js";
import { queueOutboundMessage } from "../../outbound/outbound.service.js";
import { ConversationService } from "./conversation.service.js";

function renderTemplate(content, variables = {}) {
    return Object.entries(variables).reduce((result, [key, value]) => {
        return result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), String(value ?? ""));
    }, content);
}

export class OutboundOrchestratorService {
    static async queueMessage({
        tenantId,
        unitId,
        entityType,
        entityId,
        clientId,
        enquiryId,
        channel,
        recipient,
        subject,
        body,
        templateName,
        variant,
        variables,
        metadata
    }) {
        let finalBody = body;
        let finalSubject = subject;
        let finalVariant = variant;

        if (templateName) {
            const template = await prisma.messageTemplate.findFirst({
                where: {
                    tenantId,
                    unitId,
                    channel,
                    name: templateName,
                    variant: variant || undefined,
                    status: "ACTIVE"
                },
                orderBy: { updatedAt: "desc" }
            });

            if (!template) throw new Error(`Template ${templateName} not found for ${channel}`);

            finalBody = renderTemplate(template.content, variables);
            finalSubject = template.subject ? renderTemplate(template.subject, variables) : subject;
            finalVariant = template.variant || variant;
        }

        const { conversation, message } = await ConversationService.appendMessage({
            tenantId,
            unitId,
            entityType,
            entityId,
            clientId,
            enquiryId,
            channel,
            direction: "OUTBOUND",
            body: finalBody,
            recipient,
            status: "QUEUED",
            templateName,
            variant: finalVariant,
            metadata: { ...metadata, subject: finalSubject }
        });

        try {
            await queueOutboundMessage({
                tenantId,
                unitId,
                conversationId: conversation.id,
                messageId: message.id,
                channel,
                externalUserId: recipient,
                subject: finalSubject,
                text: finalBody,
                metadata: {
                    ...(metadata || {}),
                    templateName,
                    variant: finalVariant
                }
            });
        } catch (queueError) {
            await ConversationService.updateMessageStatus({
                messageId: message.id,
                tenantId,
                unitId,
                status: "FAILED",
                deliveryStatus: "FAILED",
                metadata: {
                    queueError: queueError.message
                }
            });
            throw queueError;
        }

        return { conversation, message };
    }

    static async createCampaign({ tenantId, unitId, name, channel, templateName, audienceType, filters, scheduledAt }) {
        return prisma.outboundCampaign.create({
            data: {
                tenantId,
                unitId,
                name,
                channel,
                templateName,
                audienceType,
                filters,
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null
            }
        });
    }

    static async launchCampaign(campaignId, tenantId, unitId) {
        const campaign = await prisma.outboundCampaign.findFirst({
            where: { id: campaignId, tenantId, unitId }
        });

        if (!campaign) throw new Error("Campaign not found");

        const enquiries = await prisma.enquiry.findMany({
            where: { tenantId, unitId, isDeleted: false },
            include: { client: true },
            take: 100
        });

        let sentCount = 0;
        for (const enquiry of enquiries) {
            const recipient = campaign.channel === "email" ? enquiry.client?.email : enquiry.client?.mobile;
            if (!recipient) continue;

            await this.queueMessage({
                tenantId,
                unitId,
                entityType: "enquiry",
                entityId: enquiry.id,
                clientId: enquiry.clientId,
                enquiryId: enquiry.id,
                channel: campaign.channel,
                recipient,
                templateName: campaign.templateName,
                variables: {
                    name: enquiry.client?.name,
                    refNo: enquiry.refNo,
                    service: enquiry.serviceId || ""
                },
                metadata: { campaignId }
            });
            sentCount += 1;
        }

        return prisma.outboundCampaign.update({
            where: { id: campaignId },
            data: {
                status: "LAUNCHED",
                launchedAt: new Date(),
                sentCount
            }
        });
    }
}
