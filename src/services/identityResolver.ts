import { prisma } from "../app/prisma.js";
// @ts-ignore
import { ConversationService } from "../intelligence/services/conversation.service.js";
// @ts-ignore
import { generateRefNumber } from "../shared/utils/refGenerator.js";

type ResolveConversationInput = {
    externalUserId: string;
    channel: string;
    tenantId: string;
    unitId: string;
    profileName?: string | null;
    profileEmail?: string | null;
    subject?: string | null;
    metadata?: Record<string, unknown> | null;
};

type EnsureIdentityInput = {
    externalUserId: string;
    channel: string;
    tenantId: string;
    unitId: string;
    clientId: string;
    conversationId: string;
};

type ConversationWithChannels = {
    id: string;
    tenantId?: string;
    unitId?: string;
    clientId?: string | null;
    client?: {
        id: string;
        email?: string | null;
        mobile?: string | null;
        [key: string]: unknown;
    } | null;
    channelIdentities?: Array<{
        id?: string;
        externalUserId?: string | null;
        channel?: string | null;
        [key: string]: unknown;
    }> | null;
    messages?: Array<{
        id?: string;
        channel?: string | null;
        direction?: string | null;
        externalUserId?: string | null;
        createdAt?: string | Date | null;
        [key: string]: unknown;
    }> | null;
    [key: string]: unknown;
};

const normalizeChannel = (channel: string) => String(channel || "").trim().toLowerCase();
const isPhoneLikeChannel = (channel: string) => ["whatsapp", "call", "sms"].includes(normalizeChannel(channel));
const normalizePhoneLikeValue = (value: string) => String(value || "").trim().replace(/[^\d]/g, "");
const buildPhoneMatchCandidates = (value: string) => {
    const digits = normalizePhoneLikeValue(value);
    if (!digits) return [];

    const lastTenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
    const candidates = new Set([
        digits,
        lastTenDigits,
        `0${lastTenDigits}`,
        `91${lastTenDigits}`
    ]);

    return Array.from(candidates).filter(Boolean);
};

const normalizeExternalUserId = (channel: string, externalUserId: string) => {
    const normalizedChannel = normalizeChannel(channel);
    const value = String(externalUserId || "").trim();

    if (normalizedChannel === "email") {
        return value.toLowerCase();
    }

    if (isPhoneLikeChannel(normalizedChannel)) {
        return normalizePhoneLikeValue(value);
    }

    return value;
};

const buildSyntheticMobile = (email: string) => `email:${email.toLowerCase()}`;

const deriveClientName = (channel: string, externalUserId: string, profileName?: string | null) => {
    if (profileName && profileName.trim()) return profileName.trim();
    if (normalizeChannel(channel) === "email") {
        return externalUserId.split("@")[0] || "Email Guest";
    }
    if (normalizeChannel(channel) === "call") {
        return "Phone Caller";
    }
    if (normalizeChannel(channel) === "sms") {
        return "SMS User";
    }
    return "WhatsApp Guest";
};

const applyUnitScope = (unitId: string) => (unitId && unitId !== "ALL" ? { unitId } : {});

const isSyntheticMobile = (value?: string | null) => String(value || "").toLowerCase().startsWith("email:");

const pickBestExternalUserId = (channel: string, candidates: Array<string | null | undefined>) => {
    const normalizedChannel = normalizeChannel(channel);

    for (const candidate of candidates) {
        const rawValue = String(candidate || "").trim();

        if (!rawValue) continue;
        if (isPhoneLikeChannel(normalizedChannel) && isSyntheticMobile(rawValue)) continue;

        const normalizedValue = normalizeExternalUserId(normalizedChannel, rawValue);
        if (normalizedValue) return normalizedValue;
    }

    return null;
};

const getConversationIdentityValue = (conversation: ConversationWithChannels | null | undefined, channel: string) => {
    const normalizedChannel = normalizeChannel(channel);
    const match = conversation?.channelIdentities?.find((identity) =>
        normalizeChannel(identity?.channel || "") === normalizedChannel
    );

    return pickBestExternalUserId(normalizedChannel, [String(match?.externalUserId || "")]);
};

const getLatestMessageExternalUserId = (
    conversation: ConversationWithChannels | null | undefined,
    channel: string,
    direction?: string | null
) => {
    const normalizedChannel = normalizeChannel(channel);
    const normalizedDirection = direction ? String(direction).trim().toUpperCase() : "";
    const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
    let latestExternalUserId: string | null = null;
    let latestTimestamp = Number.NEGATIVE_INFINITY;

    messages.forEach((message) => {
        if (normalizeChannel(message?.channel || "") !== normalizedChannel) return;
        if (normalizedDirection && String(message?.direction || "").trim().toUpperCase() !== normalizedDirection) return;

        const nextExternalUserId = pickBestExternalUserId(normalizedChannel, [
            String(message?.externalUserId || "")
        ]);

        if (!nextExternalUserId) return;

        const nextTimestamp = new Date(message?.createdAt || 0).getTime();

        if (nextTimestamp >= latestTimestamp) {
            latestTimestamp = nextTimestamp;
            latestExternalUserId = nextExternalUserId;
        }
    });

    return latestExternalUserId;
};

const upsertConversationIdentityInMemory = (
    identities: Array<Record<string, unknown>>,
    nextIdentity: Record<string, unknown> & { channel?: string | null; externalUserId?: string | null }
) => {
    const normalizedChannel = normalizeChannel(String(nextIdentity.channel || ""));
    const normalizedExternalUserId = pickBestExternalUserId(normalizedChannel, [String(nextIdentity.externalUserId || "")]);
    const nextIdentities = [...identities];
    const existingIndex = nextIdentities.findIndex((identity) =>
        normalizeChannel(String(identity.channel || "")) === normalizedChannel
    );

    if (existingIndex === -1) {
        nextIdentities.push(nextIdentity);
        return nextIdentities;
    }

    const existingNormalizedExternalUserId = pickBestExternalUserId(
        normalizedChannel,
        [String(nextIdentities[existingIndex]?.externalUserId || "")]
    );

    nextIdentities[existingIndex] = normalizedExternalUserId && existingNormalizedExternalUserId === normalizedExternalUserId
        ? { ...nextIdentities[existingIndex], ...nextIdentity }
        : nextIdentity;

    return nextIdentities;
};

async function findClientByExternalIdentity({
    channel,
    externalUserId,
    tenantId,
    unitId
}: {
    channel: string;
    externalUserId: string;
    tenantId: string;
    unitId: string;
}) {
    const normalizedChannel = normalizeChannel(channel);
    const unitScope = applyUnitScope(unitId);
    const phoneCandidates = buildPhoneMatchCandidates(externalUserId);

    if (normalizedChannel === "email") {
        return prisma.client.findFirst({
            where: {
                tenantId,
                ...unitScope,
                isDeleted: false,
                OR: [
                    { email: externalUserId },
                    {
                        channelIdentities: {
                            some: {
                                externalUserId,
                                channel: "email",
                                tenantId,
                                ...unitScope
                            }
                        }
                    }
                ]
            }
        });
    }

    return prisma.client.findFirst({
        where: {
            tenantId,
            ...unitScope,
            isDeleted: false,
            OR: [
                {
                    mobile: phoneCandidates.length > 0
                        ? { in: phoneCandidates }
                        : externalUserId
                },
                {
                    channelIdentities: {
                        some: {
                            externalUserId: phoneCandidates.length > 0
                                ? { in: phoneCandidates }
                                : externalUserId,
                            channel: normalizedChannel,
                            tenantId,
                            ...unitScope
                        }
                    }
                }
            ]
        }
    });
}

async function createClientForExternalIdentity({
    channel,
    externalUserId,
    tenantId,
    unitId,
    profileName,
    profileEmail
}: {
    channel: string;
    externalUserId: string;
    tenantId: string;
    unitId: string;
    profileName?: string | null;
    profileEmail?: string | null;
}) {
    const refNo = await generateRefNumber("CLI", tenantId, unitId);
    const normalizedChannel = normalizeChannel(channel);
    const normalizedEmail = normalizedChannel === "email"
        ? externalUserId
        : (profileEmail?.trim().toLowerCase() || null);

    return prisma.client.create({
        data: {
            refNo,
            name: deriveClientName(normalizedChannel, externalUserId, profileName),
            mobile: normalizedChannel === "email" ? buildSyntheticMobile(externalUserId) : externalUserId,
            email: normalizedEmail,
            tenantId,
            unitId
        }
    });
}

export async function ensureChannelIdentity({
    externalUserId,
    channel,
    tenantId,
    unitId,
    clientId,
    conversationId
}: EnsureIdentityInput) {
    const normalizedChannel = normalizeChannel(channel);
    const normalizedExternalUserId = normalizeExternalUserId(normalizedChannel, externalUserId);

    if (!normalizedExternalUserId) return null;

    return prisma.channelIdentity.upsert({
        where: {
            externalUserId_channel_tenantId_unitId: {
                externalUserId: normalizedExternalUserId,
                channel: normalizedChannel,
                tenantId,
                unitId
            }
        },
        update: {
            clientId,
            conversationId
        },
        create: {
            externalUserId: normalizedExternalUserId,
            channel: normalizedChannel,
            clientId,
            conversationId,
            tenantId,
            unitId
        }
    });
}

export async function ensureEmailIdentity({
    client,
    conversationId,
    tenantId,
    unitId
}: {
    client: {
        id: string;
        email?: string | null;
        mobile?: string | null;
        [key: string]: unknown;
    } | null | undefined;
    conversationId: string;
    tenantId: string;
    unitId: string;
}) {
    const emailExternalUserId = pickBestExternalUserId("email", [
        String(client?.email || "")
    ]);

    if (!client?.id || !conversationId || !emailExternalUserId) {
        return null;
    }

    return ensureChannelIdentity({
        externalUserId: emailExternalUserId,
        channel: "email",
        tenantId,
        unitId,
        clientId: client.id,
        conversationId
    });
}

export async function ensureConversationChannelRecipients({
    conversation,
    tenantId,
    unitId,
    preferredEmail,
    preferredWhatsApp,
    preferredSms
}: {
    conversation: ConversationWithChannels | null;
    tenantId: string;
    unitId: string;
    preferredEmail?: string | null;
    preferredWhatsApp?: string | null;
    preferredSms?: string | null;
}) {
    if (!conversation?.id || !conversation.clientId || !conversation.client) {
        return conversation;
    }

    let nextConversation: ConversationWithChannels = {
        ...conversation,
        channelIdentities: [...(conversation.channelIdentities || [])]
    };
    const initialClient = nextConversation.client;

    if (!initialClient) {
        return nextConversation;
    }

    const emailExternalUserId = pickBestExternalUserId("email", [
        preferredEmail,
        initialClient.email,
        getConversationIdentityValue(nextConversation, "email"),
        getLatestMessageExternalUserId(nextConversation, "email", "INBOUND"),
        getLatestMessageExternalUserId(nextConversation, "email")
    ]);
    const whatsAppExternalUserId = pickBestExternalUserId("whatsapp", [
        preferredWhatsApp,
        initialClient.mobile,
        getConversationIdentityValue(nextConversation, "whatsapp"),
        getLatestMessageExternalUserId(nextConversation, "whatsapp", "INBOUND"),
        getLatestMessageExternalUserId(nextConversation, "whatsapp")
    ]);
    const smsExternalUserId = pickBestExternalUserId("sms", [
        preferredSms,
        initialClient.mobile,
        getConversationIdentityValue(nextConversation, "sms"),
        getLatestMessageExternalUserId(nextConversation, "sms", "INBOUND"),
        getLatestMessageExternalUserId(nextConversation, "sms"),
        whatsAppExternalUserId
    ]);

    const clientUpdateData: Record<string, string> = {};
    const currentEmail = String(initialClient.email || "").trim().toLowerCase();
    const currentMobile = String(initialClient.mobile || "").trim();
    const normalizedCurrentMobile = pickBestExternalUserId("whatsapp", [currentMobile]);

    if (emailExternalUserId && (!currentEmail || currentEmail === emailExternalUserId)) {
        if (currentEmail !== emailExternalUserId) {
            clientUpdateData.email = emailExternalUserId;
        }
    }

    const preferredPhoneExternalUserId = smsExternalUserId || whatsAppExternalUserId;

    if (preferredPhoneExternalUserId && (!currentMobile || isSyntheticMobile(currentMobile) || normalizedCurrentMobile === preferredPhoneExternalUserId)) {
        if (currentMobile !== preferredPhoneExternalUserId) {
            clientUpdateData.mobile = preferredPhoneExternalUserId;
        }
    }

    if (Object.keys(clientUpdateData).length > 0) {
        const updatedClient = await prisma.client.update({
            where: { id: initialClient.id },
            data: clientUpdateData
        });

        nextConversation = {
            ...nextConversation,
            client: updatedClient
        };
    }

    const hydratedClient = nextConversation.client;

    if (!hydratedClient) {
        return nextConversation;
    }

    const existingEmailIdentity = getConversationIdentityValue(nextConversation, "email");
    const existingWhatsAppIdentity = getConversationIdentityValue(nextConversation, "whatsapp");
    const existingSmsIdentity = getConversationIdentityValue(nextConversation, "sms");

    if (emailExternalUserId && existingEmailIdentity !== emailExternalUserId) {
        const emailIdentity = await ensureEmailIdentity({
            client: {
                ...hydratedClient,
                email: emailExternalUserId
            },
            conversationId: nextConversation.id,
            tenantId,
            unitId
        });

        if (emailIdentity) {
            nextConversation.channelIdentities = upsertConversationIdentityInMemory(
                (nextConversation.channelIdentities || []) as Array<Record<string, unknown>>,
                emailIdentity as Record<string, unknown> & { channel?: string | null; externalUserId?: string | null }
            );
        }
    }

    if (whatsAppExternalUserId && existingWhatsAppIdentity !== whatsAppExternalUserId) {
        const whatsAppIdentity = await ensureChannelIdentity({
            externalUserId: whatsAppExternalUserId,
            channel: "whatsapp",
            tenantId,
            unitId,
            clientId: hydratedClient.id,
            conversationId: nextConversation.id
        });

        if (whatsAppIdentity) {
            nextConversation.channelIdentities = upsertConversationIdentityInMemory(
                (nextConversation.channelIdentities || []) as Array<Record<string, unknown>>,
                whatsAppIdentity as Record<string, unknown> & { channel?: string | null; externalUserId?: string | null }
            );
        }
    }

    if (smsExternalUserId && existingSmsIdentity !== smsExternalUserId) {
        const smsIdentity = await ensureChannelIdentity({
            externalUserId: smsExternalUserId,
            channel: "sms",
            tenantId,
            unitId,
            clientId: hydratedClient.id,
            conversationId: nextConversation.id
        });

        if (smsIdentity) {
            nextConversation.channelIdentities = upsertConversationIdentityInMemory(
                (nextConversation.channelIdentities || []) as Array<Record<string, unknown>>,
                smsIdentity as Record<string, unknown> & { channel?: string | null; externalUserId?: string | null }
            );
        }
    }

    return nextConversation;
}

export class IdentityResolver {
    static normalizeExternalUserId(channel: string, externalUserId: string) {
        return normalizeExternalUserId(channel, externalUserId);
    }

    static async resolveConversation({
        externalUserId,
        channel,
        tenantId,
        unitId,
        profileName,
        profileEmail,
        subject,
        metadata
    }: ResolveConversationInput) {
        const normalizedChannel = normalizeChannel(channel);
        const normalizedExternalUserId = normalizeExternalUserId(normalizedChannel, externalUserId);
        const phoneCandidates = isPhoneLikeChannel(normalizedChannel)
            ? buildPhoneMatchCandidates(normalizedExternalUserId)
            : [];

        if (!normalizedExternalUserId) {
            throw new Error("externalUserId is required to resolve a conversation");
        }

        const existingIdentity = await prisma.channelIdentity.findFirst({
            where: {
                externalUserId: phoneCandidates.length > 0
                    ? { in: phoneCandidates }
                    : normalizedExternalUserId,
                channel: normalizedChannel,
                tenantId,
                ...applyUnitScope(unitId)
            }
        });

        if (existingIdentity) {
            return {
                conversationId: existingIdentity.conversationId,
                clientId: existingIdentity.clientId,
                externalUserId: existingIdentity.externalUserId,
                created: false
            };
        }

        let client = await findClientByExternalIdentity({
            channel: normalizedChannel,
            externalUserId: normalizedExternalUserId,
            tenantId,
            unitId
        });

        if (!client) {
            client = await createClientForExternalIdentity({
                channel: normalizedChannel,
                externalUserId: normalizedExternalUserId,
                tenantId,
                unitId,
                profileName,
                profileEmail
            });
        } else if (normalizedChannel === "email" && !client.email) {
            client = await prisma.client.update({
                where: { id: client.id },
                data: { email: normalizedExternalUserId }
            });
        } else if (["whatsapp", "sms"].includes(normalizedChannel) && isSyntheticMobile(client.mobile)) {
            client = await prisma.client.update({
                where: { id: client.id },
                data: { mobile: normalizedExternalUserId }
            });
        }

        const conversation = await ConversationService.ensureConversation({
            tenantId,
            unitId,
            entityType: "CLIENT",
            entityId: client.id,
            clientId: client.id,
            enquiryId: undefined,
            channel: normalizedChannel,
            subject,
            externalThreadId: undefined,
            metadata: {
                ...(metadata || {}),
                primaryChannel: normalizedChannel
            }
        });

        await ensureChannelIdentity({
            externalUserId: normalizedExternalUserId,
            channel: normalizedChannel,
            tenantId,
            unitId,
            clientId: client.id,
            conversationId: conversation.id
        });

        return {
            conversationId: conversation.id,
            clientId: client.id,
            externalUserId: normalizedExternalUserId,
            created: true
        };
    }

    static async resolveExternalUserIdForConversation({
        conversationId,
        channel,
        tenantId,
        unitId
    }: {
        conversationId: string;
        channel: string;
        tenantId: string;
        unitId: string;
    }) {
        const normalizedChannel = normalizeChannel(channel);
        const unitScope = applyUnitScope(unitId);

        const latestInboundMessage = await prisma.message.findFirst({
            where: {
                conversationId,
                tenantId,
                ...unitScope,
                channel: normalizedChannel,
                direction: "INBOUND",
                externalUserId: { not: null }
            },
            orderBy: { createdAt: "desc" }
        });

        if (latestInboundMessage?.externalUserId) {
            return latestInboundMessage.externalUserId;
        }

        const identity = await prisma.channelIdentity.findFirst({
            where: {
                conversationId,
                tenantId,
                ...unitScope,
                channel: normalizedChannel
            }
        });

        if (identity?.externalUserId) {
            return identity.externalUserId;
        }

        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                tenantId,
                ...unitScope
            },
            include: {
                client: true,
                channelIdentities: true,
                messages: {
                    where: {
                        externalUserId: { not: null }
                    },
                    orderBy: { createdAt: "desc" },
                    take: 20
                }
            }
        });

        const hydratedConversation = await ensureConversationChannelRecipients({
            conversation,
            tenantId,
            unitId
        });

        if (!hydratedConversation?.client) return null;

        if (normalizedChannel === "email") {
            return pickBestExternalUserId(normalizedChannel, [
                hydratedConversation.client.email,
                getConversationIdentityValue(hydratedConversation, normalizedChannel)
            ]);
        }

        if (normalizedChannel === "whatsapp") {
            return pickBestExternalUserId(normalizedChannel, [
                hydratedConversation.client.mobile,
                getConversationIdentityValue(hydratedConversation, normalizedChannel)
            ]);
        }

        if (normalizedChannel === "call") {
            return pickBestExternalUserId(normalizedChannel, [
                hydratedConversation.client.mobile,
                getConversationIdentityValue(hydratedConversation, normalizedChannel),
                getConversationIdentityValue(hydratedConversation, "sms"),
                getConversationIdentityValue(hydratedConversation, "whatsapp"),
                getLatestMessageExternalUserId(hydratedConversation, normalizedChannel),
                getLatestMessageExternalUserId(hydratedConversation, "sms"),
                getLatestMessageExternalUserId(hydratedConversation, "whatsapp")
            ]);
        }

        if (normalizedChannel === "sms") {
            return pickBestExternalUserId(normalizedChannel, [
                hydratedConversation.client.mobile,
                getConversationIdentityValue(hydratedConversation, normalizedChannel),
                getConversationIdentityValue(hydratedConversation, "whatsapp"),
                getLatestMessageExternalUserId(hydratedConversation, normalizedChannel),
                getLatestMessageExternalUserId(hydratedConversation, "whatsapp")
            ]);
        }

        return null;
    }
}
