import fs from 'fs';
import path from 'path';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getEmailInboundEnv } from '../../config/omnichannel.js';
import { prisma } from '../../app/prisma.js';
import { IdentityResolver } from '../../services/identityResolver.js';
import { ConversationService } from '../../intelligence/services/conversation.service.js';
import { logger } from '../../shared/services/logger.js';
import { cleanEmailMessage } from '../../shared/utils/messageCleaner.js';

const imapLogger = logger.child({ scope: 'imap-worker' });
let client: ImapFlow | null = null;
let isPolling = false;

const statePath = path.join(process.cwd(), '.email-state.json');

function loadState() {
    try {
        if (fs.existsSync(statePath)) {
            const data = fs.readFileSync(statePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        imapLogger.error("Failed to load email state", err);
    }
    return { lastUID: 0 };
}

function saveState(state: { lastUID: number }) {
    try {
        fs.writeFileSync(statePath, JSON.stringify(state));
    } catch (err) {
        imapLogger.error("Failed to save email state", err);
    }
}

async function getDefaultContext() {
    const tenantId = process.env.DEFAULT_WEBHOOK_TENANT_ID;
    const unitId = process.env.DEFAULT_WEBHOOK_UNIT_ID;
    if (tenantId && unitId) return { tenantId, unitId };

    const firstUser = await prisma.user.findFirst({ where: { isDeleted: false } });
    if (firstUser) return { tenantId: firstUser.tenantId, unitId: firstUser.unitId };

    throw new Error("Could not determine default tenantId and unitId");
}

async function connectIMAP(env: any) {
    try {
        client = new ImapFlow({
            host: env.IMAP_HOST || 'imap.gmail.com',
            port: env.IMAP_PORT || 993,
            secure: env.IMAP_TLS ?? true,
            auth: {
                user: env.EMAIL_USER,
                pass: env.EMAIL_PASS
            },
            socketTimeout: 120000,
            greetingTimeout: 30000,
            logger: false // Disable internal ImapFlow logger to reduce noise
        });

        client.on('error', (err) => {
            imapLogger.error("[IMAP] Client error", err);
            console.error("IMAP Client Error:", err);
            // The socket will close and trigger 'close' event
        });

        client.on('close', () => {
            imapLogger.warn("[IMAP] Connection closed. Reconnecting in 15s...");
            console.warn("IMAP Connection Closed. Reconnecting in 15s...");
            client = null;
            setTimeout(() => connectIMAP(env), 15000);
        });

        await client.connect();
        imapLogger.info(`[IMAP] Connected to ${env.IMAP_HOST || 'imap.gmail.com'}`);
        console.log("📧 EMAIL CONNECTED:", env.EMAIL_USER);

        // Listen for new messages (IDLE mode)
        client.on('exists', (data) => {
            imapLogger.info(`[IMAP] New email detected (${data.count} messages). Polling now...`);
            pollEmails(env.EMAIL_USER);
        });

        // Initial poll
        pollEmails(env.EMAIL_USER);

    } catch (error) {
        imapLogger.error("[IMAP] Connection failed, retrying in 10s...", error);
        console.error("IMAP Connection Failed. Reconnecting in 10s...", error);
        setTimeout(() => connectIMAP(env), 10000);
    }
}

export async function startImapWorker() {
    try {
        const env = getEmailInboundEnv();
        if (!env.EMAIL_USER || !env.EMAIL_PASS) {
            imapLogger.warn("IMAP credentials missing. Worker will not start.");
            return;
        }

        await connectIMAP(env);
    } catch (error) {
        imapLogger.error("[IMAP] Worker startup failed", error);
    }
}

async function pollEmails(recipientEmail: string) {
    if (!client || isPolling) return;
    isPolling = true;

    try {
        const lock = await client.getMailboxLock('INBOX');
        try {
            // Fetch unseen emails
            const messages = client.fetch({ seen: false }, { uid: true, source: true });

            for await (const msg of messages) {
                const id = msg.uid;
                if (!msg.source) {
                    imapLogger.warn(`[IMAP] Skipping email UID ${id}; source payload missing.`);
                    continue;
                }

                const parsed = await (simpleParser as any)(msg.source);

                const from = parsed.from?.value?.[0]?.address;

                if (!from) continue;

                console.log("📩 Incoming email from:", from);
                console.log("📩 Subject:", parsed.subject);

                const senderEmail = from.toLowerCase();
                const senderName = parsed.from?.value?.[0]?.name;
                const subject = parsed.subject || "No Subject";
                const rawText = parsed.text || subject;
                const body = cleanEmailMessage(rawText);
                const externalMessageId = parsed.messageId || String(id);

                const { tenantId, unitId } = await getDefaultContext();

                const resolved = await IdentityResolver.resolveConversation({
                    externalUserId: senderEmail,
                    channel: "email",
                    tenantId,
                    unitId,
                    profileName: senderName,
                    profileEmail: senderEmail,
                    subject: subject,
                    metadata: { subject }
                });

                const result = await ConversationService.addMessage({
                    tenantId,
                    unitId,
                    conversationId: resolved.conversationId,
                    entityType: "CLIENT",
                    entityId: resolved.clientId,
                    clientId: resolved.clientId,
                    channel: "email",
                    direction: "inbound",
                    body: body,
                    text: parsed.text || parsed.subject,
                    sender: senderName || senderEmail,
                    recipient: recipientEmail,
                    externalUserId: from,
                    externalMessageId: externalMessageId,
                    status: "RECEIVED",
                    deliveryStatus: "RECEIVED",
                    metadata: { subject, rawBody: parsed.text || parsed.html },
                    rawPayload: {}
                } as any);

                if (result?.duplicate) {
                    imapLogger.info("Ignored duplicate inbound email via IMAP", { externalMessageId });
                }

                imapLogger.info(`[IMAP] Processed email UID ${id}.`);
                
                // Mark as seen
                await client.messageFlagsAdd({ uid: id }, ['\\Seen'], { uid: true });
            }
        } finally {
            lock.release();
        }
    } catch (error) {
        imapLogger.error("[IMAP] Error during polling loop", error);
    } finally {
        isPolling = false;
    }
}

export async function stopImapWorker() {
    if (client) {
        await client.logout();
        imapLogger.info("[IMAP] Connection closed");
    }
}
