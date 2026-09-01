import type { Request, Response } from "express";
import { OmniParser } from "../core/OmniParser.js";
import { TriggerEngine } from "../core/TriggerEngine.js";
import { prisma } from "../../app/prisma.js";

export class OmniController {
    static async whatsappWebhook(req: Request, res: Response) {
        try {
            console.log("📱 WhatsApp Webhook Received");
            const omniPayload = OmniParser.normalizeWhatsApp(req.body);

            // 1. Log communication
            // @ts-ignore
            await prisma.communicationLog.create({
                data: { // @ts-ignore
                    tenantId: omniPayload.tenantId,
                    unitId: omniPayload.unitId,
                    source: omniPayload.source,
                    externalId: omniPayload.externalId,
                    contact: omniPayload.contact as any,
                    message: omniPayload.message
                } as any
            });

            // 2. Trigger Automation Pipeline
            await TriggerEngine.processEvent(
                omniPayload.tenantId,
                omniPayload.unitId,
                "enquiry",
                "ENQUIRY_CREATED",
                omniPayload.externalId || Date.now().toString(),
                omniPayload,
                omniPayload.source
            );

            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ WhatsApp Webhook error:", err);
            res.status(500).json({ error: "Webhook processing failed" });
        }
    }

    static async emailWebhook(req: Request, res: Response) {
        try {
            console.log("📧 Email Webhook Received");
            const omniPayload = OmniParser.normalizeEmail(req.body);

            // 1. Log communication
            // @ts-ignore
            await prisma.communicationLog.create({
                data: { // @ts-ignore
                    tenantId: omniPayload.tenantId,
                    unitId: omniPayload.unitId,
                    source: omniPayload.source,
                    externalId: omniPayload.externalId,
                    contact: omniPayload.contact as any,
                    message: omniPayload.message
                } as any
            });

            // 2. Trigger Automation Pipeline
            await TriggerEngine.processEvent(
                omniPayload.tenantId,
                omniPayload.unitId,
                "enquiry",
                "ENQUIRY_CREATED",
                omniPayload.externalId || Date.now().toString(),
                omniPayload,
                omniPayload.source
            );

            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ Email Webhook error:", err);
            res.status(500).json({ error: "Webhook processing failed" });
        }
    }
}
