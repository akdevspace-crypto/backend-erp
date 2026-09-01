import assert from "node:assert/strict";
import crypto from "node:crypto";
import { prisma } from "../app/prisma.js";
import { ConversationService } from "../intelligence/services/conversation.service.js";
import {
    buildEmailInbound,
    extractWhatsAppEntries,
    verifyHmacSignature
} from "../modules/webhooks/controller.js";
import { processOutboundMessageJob } from "../outbound/outbound.processor.js";
import {
    ensureConversationChannelRecipients,
    IdentityResolver
} from "../services/identityResolver.js";

const log = (message: string, details?: Record<string, unknown>) => {
    if (details) {
        console.log(`[omni-test] ${message}`, details);
        return;
    }

    console.log(`[omni-test] ${message}`);
};

async function testWebhookSignatureVerification() {
    const secret = "super-secret";
    const rawBody = Buffer.from(JSON.stringify({ hello: "world" }), "utf8");
    const validSignature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    assert.equal(verifyHmacSignature(rawBody, validSignature, secret, "sha256="), true);
    assert.equal(verifyHmacSignature(rawBody, "sha256=deadbeef", secret, "sha256="), false);

    log("Webhook signature verification passed");
}

async function testWebhookPayloadNormalization() {
    const whatsappEntries = extractWhatsAppEntries({
        entry: [{
            changes: [{
                value: {
                    contacts: [{
                        wa_id: "919876543210",
                        profile: {
                            name: "Omni Tester"
                        }
                    }],
                    messages: [{
                        id: "wamid.inbound.1",
                        from: "+91 98765 43210",
                        text: {
                            body: "Hello from WhatsApp"
                        }
                    }],
                    statuses: [{
                        id: "wamid.outbound.1",
                        status: "delivered",
                        timestamp: "1710000000"
                    }]
                }
            }]
        }]
    });

    assert.equal(whatsappEntries.length, 2);
    assert.equal(whatsappEntries[0]?.kind, "message");
    assert.equal(whatsappEntries[0]?.externalUserId, "919876543210");
    assert.equal(whatsappEntries[0]?.body, "Hello from WhatsApp");
    assert.equal(whatsappEntries[1]?.kind, "status");
    assert.equal(whatsappEntries[1]?.deliveryStatus, "DELIVERED");

    const emailInbound = buildEmailInbound({
        from_email: "Customer@Example.com",
        subject: "Need help",
        text: "Checking email webhook",
        message_id: "email-message-1",
        from_name: "Customer Name"
    });

    assert.equal(emailInbound.externalUserId, "customer@example.com");
    assert.equal(emailInbound.subject, "Need help");
    assert.equal(emailInbound.body, "Checking email webhook");
    assert.equal(emailInbound.externalMessageId, "email-message-1");
    assert.equal(emailInbound.senderName, "Customer Name");

    log("Webhook payload normalization passed");
}

async function testOutboundRetryAndFailureTransitions() {
    const statusTransitions: Array<Record<string, unknown>> = [];
    const messageRecord = {
        id: "message-1",
        status: "QUEUED",
        deliveryStatus: "QUEUED",
        channel: "whatsapp",
        externalUserId: "919999999999"
    };

    const baseDeps = {
        findMessage: async () => messageRecord,
        logger: {
            info() { },
            error() { },
            warn() { }
        }
    };

    await assert.rejects(() => processOutboundMessageJob({
        data: {
            tenantId: "tenant-a",
            unitId: "unit-a",
            conversationId: "conversation-a",
            messageId: "message-1",
            channel: "whatsapp",
            externalUserId: "919999999999",
            text: "hello"
        },
        attemptsMade: 0,
        opts: { attempts: 3 }
    } as any, {
        ...baseDeps,
        sendToChannel: async () => {
            throw new Error("provider temporarily unavailable");
        },
        updateMessageStatus: async (payload: Record<string, unknown>) => {
            statusTransitions.push(payload);
            return payload;
        }
    }), /provider temporarily unavailable/);

    assert.equal(statusTransitions.at(-1)?.status, "RETRYING");
    assert.equal(statusTransitions.at(-1)?.deliveryStatus, "RETRYING");

    await assert.rejects(() => processOutboundMessageJob({
        data: {
            tenantId: "tenant-a",
            unitId: "unit-a",
            conversationId: "conversation-a",
            messageId: "message-1",
            channel: "whatsapp",
            externalUserId: "919999999999",
            text: "hello"
        },
        attemptsMade: 2,
        opts: { attempts: 3 }
    } as any, {
        ...baseDeps,
        sendToChannel: async () => {
            throw new Error("provider permanently unavailable");
        },
        updateMessageStatus: async (payload: Record<string, unknown>) => {
            statusTransitions.push(payload);
            return payload;
        }
    }), /provider permanently unavailable/);

    assert.equal(statusTransitions.at(-1)?.status, "FAILED");
    assert.equal(statusTransitions.at(-1)?.deliveryStatus, "FAILED");

    log("Outbound retry and failure transitions passed");
}

async function testLiveDatabaseFlows() {
    if (!process.env.DATABASE_URL) {
        log("Skipping live database omnichannel checks because DATABASE_URL is not configured");
        return;
    }

    try {
        await prisma.$connect();
    } catch (error: any) {
        log("Skipping live database omnichannel checks because the database connection is unavailable", {
            code: error?.errorCode || error?.code || "UNKNOWN",
            reason: error?.message || String(error)
        });
        return;
    }

    const createdClientIds: string[] = [];
    const createdConversationIds: string[] = [];

    const createClientAndConversation = async (tenantId: string, unitId: string, suffix: string) => {
        const numericSuffix = suffix.replace(/\D/g, "").slice(-10).padEnd(10, "0");
        const client = await prisma.client.create({
            data: {
                refNo: `CLI-OMNI-${suffix}`,
                name: `Omni Test ${suffix}`,
                mobile: `91${numericSuffix}`,
                tenantId,
                unitId
            }
        });

        createdClientIds.push(client.id);

        const conversation = await ConversationService.ensureConversation({
            tenantId,
            unitId,
            entityType: "CLIENT",
            entityId: client.id,
            clientId: client.id,
            channel: "whatsapp",
            metadata: {
                testRun: suffix
            }
        });

        createdConversationIds.push(conversation.id);

        return { client, conversation };
    };

    try {
        const suffix = `${Date.now()}`;
        const primaryTenantId = `omni-tenant-${suffix}`;
        const primaryUnitId = `omni-unit-${suffix}`;
        const alternateTenantId = `omni-tenant-alt-${suffix}`;
        const alternateUnitId = `omni-unit-alt-${suffix}`;
        const sharedExternalMessageId = `wa-shared-${suffix}`;

        const primary = await createClientAndConversation(primaryTenantId, primaryUnitId, suffix);
        const normalizedPrimaryPhone = primary.client.mobile;

        const firstResolvedWhatsApp = await IdentityResolver.resolveConversation({
            externalUserId: `+${normalizedPrimaryPhone}`,
            channel: "whatsapp",
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            profileName: primary.client.name
        });

        assert.equal(firstResolvedWhatsApp.clientId, primary.client.id);
        assert.equal(firstResolvedWhatsApp.conversationId, primary.conversation.id);
        assert.equal(firstResolvedWhatsApp.externalUserId, normalizedPrimaryPhone);
        assert.equal(firstResolvedWhatsApp.created, true);

        const secondResolvedWhatsApp = await IdentityResolver.resolveConversation({
            externalUserId: normalizedPrimaryPhone,
            channel: "whatsapp",
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            profileName: primary.client.name
        });

        assert.equal(secondResolvedWhatsApp.clientId, primary.client.id);
        assert.equal(secondResolvedWhatsApp.conversationId, primary.conversation.id);
        assert.equal(secondResolvedWhatsApp.created, false);

        const firstInbound = await ConversationService.appendMessage({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            conversationId: primary.conversation.id,
            entityType: "CLIENT",
            entityId: primary.client.id,
            clientId: primary.client.id,
            channel: "whatsapp",
            direction: "INBOUND",
            body: "Hello from WhatsApp",
            sender: primary.client.mobile,
            recipient: "erp",
            externalUserId: primary.client.mobile,
            externalMessageId: sharedExternalMessageId,
            status: "RECEIVED",
            deliveryStatus: "RECEIVED"
        });

        const duplicateInbound = await ConversationService.appendMessage({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            conversationId: primary.conversation.id,
            entityType: "CLIENT",
            entityId: primary.client.id,
            clientId: primary.client.id,
            channel: "whatsapp",
            direction: "INBOUND",
            body: "Hello from WhatsApp",
            sender: primary.client.mobile,
            recipient: "erp",
            externalUserId: primary.client.mobile,
            externalMessageId: sharedExternalMessageId,
            status: "RECEIVED",
            deliveryStatus: "RECEIVED"
        });

        assert.equal(Boolean(firstInbound?.message?.id), true);
        assert.equal(Boolean(duplicateInbound?.duplicate), true);

        const primaryDuplicateCount = await prisma.message.count({
            where: {
                tenantId: primaryTenantId,
                unitId: primaryUnitId,
                channel: "whatsapp",
                externalMessageId: sharedExternalMessageId
            }
        });

        assert.equal(primaryDuplicateCount, 1);

        const primaryEmail = `omni.${suffix}@example.com`;
        await prisma.client.update({
            where: { id: primary.client.id },
            data: { email: primaryEmail }
        });

        const hydratedConversation = await ensureConversationChannelRecipients({
            conversation: await ConversationService.getConversationById(
                primary.conversation.id,
                primaryTenantId,
                primaryUnitId
            ),
            tenantId: primaryTenantId,
            unitId: primaryUnitId
        });

        assert.equal(hydratedConversation?.client?.email, primaryEmail);
        assert.equal(
            hydratedConversation?.channelIdentities?.some((identity) =>
                identity.channel === "email" && identity.externalUserId === primaryEmail
            ),
            true
        );

        const resolvedEmail = await IdentityResolver.resolveConversation({
            externalUserId: primaryEmail.toUpperCase(),
            channel: "email",
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            profileName: primary.client.name,
            profileEmail: primaryEmail,
            subject: "Email handshake"
        });

        assert.equal(resolvedEmail.clientId, primary.client.id);
        assert.equal(resolvedEmail.conversationId, primary.conversation.id);
        assert.equal(resolvedEmail.externalUserId, primaryEmail);

        const primaryClientCount = await prisma.client.count({
            where: {
                tenantId: primaryTenantId,
                unitId: primaryUnitId
            }
        });

        assert.equal(primaryClientCount, 1);

        const resolvedEmailRecipient = await IdentityResolver.resolveExternalUserIdForConversation({
            conversationId: primary.conversation.id,
            channel: "email",
            tenantId: primaryTenantId,
            unitId: primaryUnitId
        });

        const resolvedWhatsAppRecipient = await IdentityResolver.resolveExternalUserIdForConversation({
            conversationId: primary.conversation.id,
            channel: "whatsapp",
            tenantId: primaryTenantId,
            unitId: primaryUnitId
        });

        assert.equal(resolvedEmailRecipient, primaryEmail);
        assert.equal(resolvedWhatsAppRecipient, normalizedPrimaryPhone);

        const emailExternalMessageId = `email-in-${suffix}`;
        const emailInbound = await ConversationService.appendMessage({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            conversationId: primary.conversation.id,
            entityType: "CLIENT",
            entityId: primary.client.id,
            clientId: primary.client.id,
            channel: "email",
            direction: "INBOUND",
            body: "Hello from email",
            sender: primaryEmail,
            recipient: "erp@example.com",
            externalUserId: primaryEmail,
            externalMessageId: emailExternalMessageId,
            status: "RECEIVED",
            deliveryStatus: "RECEIVED",
            metadata: {
                subject: "Email hello"
            }
        });

        assert.equal(emailInbound.conversation.id, primary.conversation.id);

        const defaultReplyChannel = await ConversationService.getDefaultReplyChannel(
            primary.conversation.id,
            primaryTenantId,
            primaryUnitId
        );

        assert.equal(defaultReplyChannel, "email");

        await prisma.channelIdentity.deleteMany({
            where: {
                tenantId: primaryTenantId,
                unitId: primaryUnitId,
                conversationId: primary.conversation.id,
                channel: "email"
            }
        });

        await prisma.client.update({
            where: { id: primary.client.id },
            data: { email: null }
        });

        const recoveredConversation = await ensureConversationChannelRecipients({
            conversation: await ConversationService.getConversationById(
                primary.conversation.id,
                primaryTenantId,
                primaryUnitId
            ),
            tenantId: primaryTenantId,
            unitId: primaryUnitId
        });

        assert.equal(recoveredConversation?.client?.email, primaryEmail);
        assert.equal(
            recoveredConversation?.channelIdentities?.some((identity) =>
                identity.channel === "email" && identity.externalUserId === primaryEmail
            ),
            true
        );

        const outboundExternalMessageId = `wa-out-${suffix}`;
        const outbound = await ConversationService.appendMessage({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            conversationId: primary.conversation.id,
            entityType: "CLIENT",
            entityId: primary.client.id,
            clientId: primary.client.id,
            channel: "whatsapp",
            direction: "OUTBOUND",
            body: "Status progression",
            sender: "agent@example.com",
            recipient: primary.client.mobile,
            externalUserId: primary.client.mobile,
            externalMessageId: outboundExternalMessageId,
            status: "SENT",
            deliveryStatus: "SENT"
        });

        const readAt = new Date();
        await ConversationService.updateMessageStatusByExternalId({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            channel: "whatsapp",
            externalMessageId: outboundExternalMessageId,
            status: "READ",
            deliveryStatus: "READ",
            readAt
        });

        await ConversationService.updateMessageStatusByExternalId({
            tenantId: primaryTenantId,
            unitId: primaryUnitId,
            channel: "whatsapp",
            externalMessageId: outboundExternalMessageId,
            status: "DELIVERED",
            deliveryStatus: "DELIVERED",
            deliveredAt: new Date(readAt.getTime() - 1000)
        });

        const reloadedOutbound = await prisma.message.findUnique({
            where: { id: outbound.message.id }
        });

        assert.equal(reloadedOutbound?.deliveryStatus, "READ");
        assert.equal(Boolean(reloadedOutbound?.readAt), true);

        const alternate = await createClientAndConversation(alternateTenantId, alternateUnitId, `${suffix}-alt`);
        const alternateInbound = await ConversationService.appendMessage({
            tenantId: alternateTenantId,
            unitId: alternateUnitId,
            conversationId: alternate.conversation.id,
            entityType: "CLIENT",
            entityId: alternate.client.id,
            clientId: alternate.client.id,
            channel: "whatsapp",
            direction: "INBOUND",
            body: "Alternate tenant message",
            sender: alternate.client.mobile,
            recipient: "erp",
            externalUserId: alternate.client.mobile,
            externalMessageId: sharedExternalMessageId,
            status: "RECEIVED",
            deliveryStatus: "RECEIVED"
        });

        assert.equal(Boolean(alternateInbound?.message?.id), true);

        const alternateCount = await prisma.message.count({
            where: {
                tenantId: alternateTenantId,
                unitId: alternateUnitId,
                channel: "whatsapp",
                externalMessageId: sharedExternalMessageId
            }
        });

        assert.equal(alternateCount, 1);

        log("Live database identity mapping, idempotency, lifecycle, and tenant isolation checks passed");
    } finally {
        if (createdConversationIds.length) {
            await prisma.message.deleteMany({
                where: {
                    conversationId: { in: createdConversationIds }
                }
            });

            await prisma.channelIdentity.deleteMany({
                where: {
                    conversationId: { in: createdConversationIds }
                }
            });

            await prisma.communicationLog.deleteMany({
                where: {
                    conversationId: { in: createdConversationIds }
                }
            });

            await prisma.conversation.deleteMany({
                where: {
                    id: { in: createdConversationIds }
                }
            });
        }

        if (createdClientIds.length) {
            await prisma.client.deleteMany({
                where: {
                    id: { in: createdClientIds }
                }
            });
        }

        await prisma.$disconnect();
    }
}

async function main() {
    await testWebhookSignatureVerification();
    await testWebhookPayloadNormalization();
    await testOutboundRetryAndFailureTransitions();
    await testLiveDatabaseFlows();
    log("All omnichannel hardening checks passed");
}

main().catch(async (error) => {
    console.error("[omni-test] Failure", error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
});
