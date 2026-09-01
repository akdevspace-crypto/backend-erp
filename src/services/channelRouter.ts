import axios from "axios";
import nodemailer from "nodemailer";
import { getEmailChannelEnv, getWhatsAppChannelEnv } from "../config/omnichannel.js";
import { sendSMS } from "./twilioService.js";
import { logger } from "../shared/services/logger.js";

type ChannelMessage = {
    tenantId: string;
    unitId: string;
    conversationId: string;
    messageId: string;
    text: string;
    channel: string;
    externalUserId: string;
    subject?: string | null;
    metadata?: Record<string, unknown> | null;
};

const normalizeChannel = (channel: string) => String(channel || "").trim().toLowerCase();
const channelLogger = logger.child({ scope: "channel-router" });
const buildTextPreview = (text: string) => {
    const normalized = String(text || "").trim();
    return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
};

const getMailerTransport = () => {
    const env = getEmailChannelEnv();
    const smtpHost = env.SMTP_HOST?.trim();
    const smtpPort = Number(env.SMTP_PORT || 587);
    const smtpSecure = env.SMTP_SECURE === true;

    if (smtpHost) {
        return nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: env.EMAIL_USER && env.EMAIL_PASS
                ? {
                    user: env.EMAIL_USER,
                    pass: env.EMAIL_PASS
                }
                : undefined
        });
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: env.EMAIL_USER,
            pass: env.EMAIL_PASS
        }
    });
};

let mailTransport: nodemailer.Transporter | null = null;
let mailTransportVerified = false;

const getMailTransport = () => {
    if (!mailTransport) {
        mailTransport = getMailerTransport();
    }

    return mailTransport;
};

const ensureMailTransportReady = async () => {
    if (mailTransportVerified) return;

    const env = getEmailChannelEnv();
    const transport = getMailTransport();
    await transport.verify();
    mailTransportVerified = true;

    channelLogger.info("Email transport verified", {
        provider: env.SMTP_HOST?.trim() ? "smtp" : "gmail",
        sender: env.EMAIL_FROM || env.EMAIL_USER
    });
};

async function sendWhatsApp(message: ChannelMessage) {
    const env = getWhatsAppChannelEnv();

    const response = await axios.post(
        `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_ID}/messages`,
        {
            messaging_product: "whatsapp",
            to: message.externalUserId,
            type: "text",
            text: { body: message.text }
        },
        {
            headers: {
                Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
            },
            timeout: 15000
        }
    );

    return {
        externalMessageId: response.data?.messages?.[0]?.id || null,
        deliveryStatus: "SENT",
        providerResponse: response.data
    };
}

async function sendEmail(message: ChannelMessage) {
    const env = getEmailChannelEnv();
    const recipient = String(message.externalUserId || "").trim().toLowerCase();

    if (!recipient) {
        throw new Error("Customer email is required to send email");
    }

    console.log("[EMAIL_DISPATCH]", {
        to: recipient,
        text: message.text,
        channel: normalizeChannel(message.channel)
    });

    channelLogger.info("Email dispatch prepared", {
        channel: "email",
        to: recipient,
        subject: message.subject || "ERP Message",
        textPreview: buildTextPreview(message.text),
        conversationId: message.conversationId,
        messageId: message.messageId,
        tenantId: message.tenantId,
        unitId: message.unitId
    });

    await ensureMailTransportReady();

    const info = await getMailTransport().sendMail({
        from: env.EMAIL_FROM || env.EMAIL_USER,
        to: recipient,
        subject: message.subject || "ERP Message",
        text: message.text
    });

    return {
        externalMessageId: info.messageId || null,
        deliveryStatus: "SENT",
        providerResponse: {
            accepted: info.accepted,
            rejected: info.rejected,
            response: info.response
        }
    };
}

async function sendSms(message: ChannelMessage) {
    const recipient = String(message.externalUserId || "").trim();

    if (!recipient) {
        throw new Error("Customer phone number is required to send SMS");
    }

    const response = await sendSMS(recipient, message.text);

    return {
        externalMessageId: response.sid || null,
        deliveryStatus: String(response.status || "SENT").toUpperCase(),
        providerResponse: {
            sid: response.sid,
            status: response.status,
            from: response.from,
            to: response.to
        }
    };
}

export async function sendToChannel(message: ChannelMessage) {
    const normalizedChannel = normalizeChannel(message.channel);
    const logContext = {
        channel: normalizedChannel,
        externalUserId: message.externalUserId,
        conversationId: message.conversationId,
        messageId: message.messageId,
        tenantId: message.tenantId,
        unitId: message.unitId
    };

    channelLogger.info("Dispatching outbound message to channel", logContext);

    try {
        switch (normalizedChannel) {
            case "whatsapp":
                return await sendWhatsApp(message);
            case "email":
                return await sendEmail(message);
            case "sms":
                return await sendSms(message);
            default:
                throw new Error(`Unsupported outbound channel: ${message.channel}`);
        }
    } catch (error) {
        channelLogger.error("Outbound channel dispatch failed", {
            ...logContext,
            error
        });
        throw error;
    }
}
