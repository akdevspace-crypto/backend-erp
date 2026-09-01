import { prisma } from "../../app/prisma.js";
import { emitRealtimeEvent } from "../../shared/services/socket.js";
// @ts-ignore
import { RevenueForecastService } from "../../intelligence/services/revenue-forecast.service.js";
import { analyzeNLP, type NLPAnalysis, type NLPIntent, type NLPSentiment } from "./nlp.service.js";
// @ts-ignore
import { createAITaskFromEnquiry } from "../tasks/service.js";
// @ts-ignore
import { FeedbackLearningService } from "../../intelligence/services/feedback-learning.service.js";

type TenantContext = {
    tenantId: string;
    unitId: string;
    userId?: string | null;
};

type ScoringPayload = {
    enquiryId?: string;
    serviceId?: string | null;
    cityId?: string | null;
    contactAvailable?: boolean;
    source?: string | null;
    channel?: string | null;
    rawMessage?: string | null;
    description?: string | null;
    sentiment?: string | null;
    intent?: string | null;
    urgency?: string | null;
    healthCondition?: string | null;
    status?: string | null;
};

type NLPPayload = {
    enquiryId?: string;
    complaintId?: string;
    message?: string;
};

type AllocationPayload = {
    taskId?: string;
    enquiryId?: string;
    taskType?: string | null;
    serviceId?: string | null;
    cityId?: string | null;
    unitId?: string | null;
    nlp?: Pick<NLPAnalysis, "intent" | "urgency"> | null;
};

const buildHttpError = (message: string, status = 400) => {
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    return error;
};

const normalizeIntent = (intent?: string | null): NLPIntent => {
    const value = String(intent || "").toLowerCase();
    if (value.includes("emergency") || value.includes("urgent")) return "emergency";
    if (value.includes("complaint")) return "complaint";
    if (value.includes("support")) return "support";
    return "enquiry";
};

const normalizeSentiment = (sentiment?: string | null): NLPSentiment => {
    const value = String(sentiment || "").toLowerCase();
    if (value.includes("negative")) return "negative";
    if (value.includes("positive")) return "positive";
    return "neutral";
};

const normalizeUrgency = (urgency?: string | null): NLPAnalysis["urgency"] => {
    const value = String(urgency || "").toUpperCase();
    if (value === "HIGH") return "HIGH";
    if (value === "MEDIUM") return "MEDIUM";
    return "LOW";
};

const isTextUrgent = (text: string) => /(urgent|immediate|asap|emergency|critical)/i.test(text);

export class AIDecisionService {
    static async scoreLead(context: TenantContext, payload: ScoringPayload) {
        let score = 50;
        const factors: Record<string, number | string> = { base: 50 };

        if (payload.contactAvailable) {
            score += 10;
            factors.contactAvailability = 10;
        }

        if (payload.serviceId) {
            const activeService = await (prisma as any).clientService.findFirst({
                where: {
                    id: payload.serviceId,
                    tenantId: context.tenantId,
                    unitId: context.unitId,
                    isDeleted: false,
                    status: true
                },
                select: { id: true }
            });

            if (activeService) {
                score += 10;
                factors.activeService = 10;
            }
        }

        if (payload.cityId) {
            score += 10;
            factors.highDemandCity = 10;
        }

        const signalText = `${payload.source || ""} ${payload.channel || ""}`.toLowerCase();
        if (signalText.includes("referral") || signalText.includes("whatsapp") || signalText.includes("website")) {
            score += 5;
            factors.channelSignal = 5;
        }

        const body = `${payload.rawMessage || ""} ${payload.description || ""}`.trim();
        if (!payload.contactAvailable || !payload.serviceId || body.length < 10) {
            score -= 10;
            factors.incompleteData = -10;
        }

        if (payload.sentiment) {
            const sentiment = normalizeSentiment(payload.sentiment);
            factors.sentiment = sentiment;
            if (sentiment === "negative") score += 5;
        }

        if (payload.intent) {
            const intent = normalizeIntent(payload.intent);
            factors.intent = intent;
            if (intent === "emergency") score += 20;
            if (intent === "complaint" || intent === "support") score += 5;
        }

        if (payload.urgency) {
            const urgency = normalizeUrgency(payload.urgency);
            factors.urgency = urgency;
            if (urgency === "HIGH") score += 15;
            if (urgency === "MEDIUM") score += 5;
        }

        // 🔹 Status-based boost
        if (payload.status === "Emergency") {
            score += 30;
            factors.statusBoost = 30;
        } else if (payload.status === "Important") {
            score += 15;
            factors.statusBoost = 15;
        }

        // 🔹 Health Condition-based boost
        if (payload.healthCondition) {
            const hc = payload.healthCondition.toLowerCase();
            if (/(critical|serious|icu|oxygen|ventilator|breathing|deadly|severe)/i.test(hc)) {
                score += 25;
                factors.healthBoost = 25;
            } else if (/(physio|stable|general|monitoring|follow)/i.test(hc)) {
                score += 5;
                factors.healthBoost = 5;
            }
        }

        score = Math.min(100, Math.max(0, score));
        const priority = score >= 75 ? "HOT" : score >= 45 ? "WARM" : "COLD";

        const result = {
            score,
            priority,
            probability: Number((score / 100).toFixed(2)),
            factors
        };

        if (payload.enquiryId) {
            await (prisma as any).automationScore.upsert({
                where: {
                    entityId_module: {
                        entityId: payload.enquiryId,
                        module: "enquiry"
                    }
                },
                update: {
                    score,
                    label: priority,
                    probability: result.probability,
                    confidence: 0.85,
                    factors
                },
                create: {
                    entityId: payload.enquiryId,
                    module: "enquiry",
                    tenantId: context.tenantId,
                    unitId: context.unitId,
                    score,
                    label: priority,
                    probability: result.probability,
                    confidence: 0.85,
                    factors
                }
            });

            await (prisma as any).enquiry.update({
                where: { id: payload.enquiryId },
                data: {
                    score,
                    priority
                }
            });

            emitRealtimeEvent("score_updated", {
                tenantId: context.tenantId,
                unitId: context.unitId,
                enquiryId: payload.enquiryId,
                ...result
            });
        }

        return result;
    }

    static async analyzeMessage(context: TenantContext, payload: NLPPayload) {
        const resolvedMessage = payload.message || await this.resolveMessageFromEntity(context, payload);
        const aiResult = await analyzeNLP(resolvedMessage || "");

        const result = {
            intent: normalizeIntent(aiResult.intent || (isTextUrgent(resolvedMessage || "") ? "urgent" : "enquiry")),
            sentiment: normalizeSentiment(aiResult.sentiment),
            summary: aiResult.summary || resolvedMessage?.slice(0, 100) || "",
            urgency: aiResult.urgency || (isTextUrgent(resolvedMessage || "") ? "HIGH" : "LOW")
        };

        if (payload.enquiryId) {
            await (prisma as any).enquiry.update({
                where: { id: payload.enquiryId },
                data: {
                    intent: result.intent,
                    sentiment: result.sentiment,
                    summary: result.summary,
                    urgency: result.urgency
                }
            });
        }

        return result;
    }

    static async allocate(context: TenantContext, payload: AllocationPayload) {
        if (!payload.taskId) {
            throw buildHttpError("Task must exist before allocation", 400);
        }

        const targetUnitId = payload.unitId || context.unitId;
        const resolvedTask = payload.taskId
            ? await (prisma as any).task.findFirst({
                where: {
                    id: payload.taskId,
                    tenantId: context.tenantId,
                    unitId: targetUnitId,
                    isDeleted: false
                }
            })
            : null;

        const taskType = payload.taskType || resolvedTask?.type || "GENERAL";

        const staffList = await (prisma as any).staff.findMany({
            where: {
                tenantId: context.tenantId,
                unitId: targetUnitId,
                isDeleted: false,
                isAvailable: true,
                userId: { not: null },
                user: {
                    is: {
                        isDeleted: false,
                        isActive: true
                    }
                }
            },
            include: {
                user: true
            }
        });

        if (!staffList.length) {
            throw buildHttpError("No eligible staff available for allocation.", 404);
        }

        const scoredStaff = staffList
            .map((staff: any) => {
                const performance = Number(staff.performanceScore || 0);
                const workload = Number(staff.currentWorkload ?? staff.workload ?? 0);
                const availability = staff.isAvailable ? 20 : 0;
                const designationBoost = String(staff.designation || "").toLowerCase().includes(String(taskType).toLowerCase()) ? 10 : 0;
                const emergencyBoost = payload.nlp?.intent === "emergency" || payload.nlp?.urgency === "HIGH" ? 10 : 0;
                const supportBoost = payload.nlp?.intent === "complaint" || payload.nlp?.intent === "support" ? 5 : 0;
                const score = performance + availability + designationBoost + emergencyBoost + supportBoost - (workload * 5);

                return {
                    staff,
                    score
                };
            })
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        const best = scoredStaff[0]?.staff;
        if (!best?.userId) {
            throw buildHttpError("No staff login found for auto allocation.", 400);
        }

        await (prisma as any).task.update({
            where: { id: payload.taskId },
            data: {
                assigneeId: best.userId,
                assignedStaffId: best.id
            }
        });

        await (prisma as any).staff.update({
            where: { id: best.id },
            data: {
                workload: { increment: 1 },
                currentWorkload: { increment: 1 }
            }
        });

        emitRealtimeEvent("task_assigned", {
            tenantId: context.tenantId,
            unitId: targetUnitId,
            taskId: payload.taskId,
            assignedStaffId: best.id,
            assignedUserId: best.userId
        });

        console.log("ALLOCATED TO:", best.id);

        return {
            assignedStaffId: best.id,
            assignedUserId: best.userId
        };
    }

    static async buildForecast(context: TenantContext, options: Record<string, unknown> = {}) {
        const forecast = await RevenueForecastService.buildForecast(context.tenantId, context.unitId, options);
        const result = {
            expectedRevenue: forecast.expectedRevenue ?? forecast.projectedRevenue,
            growthRate: forecast.growthRate,
            forecastId: forecast.id
        };

        emitRealtimeEvent("forecast_updated", {
            tenantId: context.tenantId,
            unitId: context.unitId,
            ...result
        });

        return result;
    }

    static async processEvent(context: TenantContext, event: string, payload: Record<string, any>) {
        switch (event) {
            case "ENQUIRY_CREATED":
            case "ENQUIRY_FOLLOW_UP": {
                const enquiry = await (prisma as any).enquiry.findFirst({
                    where: {
                        id: payload.entityId || payload.enquiryId,
                        tenantId: context.tenantId,
                        unitId: context.unitId
                    },
                    include: { client: true }
                });

                if (!enquiry) throw buildHttpError("Enquiry not found", 404);

                let meta: any = {};
                try {
                    meta = enquiry.rawMessage ? JSON.parse(enquiry.rawMessage) : {};
                } catch (e) {
                    console.warn("Could not parse enquiry rawMessage JSON", e);
                }

                // For follow-up, use the notes as the primary message for interpretation
                const message = event === "ENQUIRY_FOLLOW_UP"
                    ? (payload.input?.notes || payload.input?.description || enquiry.description || "")
                    : (enquiry.description || meta.patientHealthCondition || meta.remarks || "");

                const nlp = await this.analyzeMessage(context, {
                    enquiryId: enquiry.id,
                    message: message
                });

                console.log("AI OUTPUT:", nlp);

                const scoring = await this.scoreLead(context, {
                    enquiryId: enquiry.id,
                    serviceId: enquiry.serviceId,
                    cityId: null,
                    contactAvailable: Boolean(enquiry.client?.mobile || enquiry.client?.email),
                    source: enquiry.source,
                    channel: enquiry.mode,
                    rawMessage: enquiry.rawMessage,
                    description: enquiry.description,
                    sentiment: nlp.sentiment,
                    intent: nlp.intent,
                    urgency: payload.status === 'Emergency' ? 'HIGH' : (payload.status === 'Important' ? 'MEDIUM' : nlp.urgency),
                    status: payload.status || enquiry.status,
                    healthCondition: payload.patientHealthCondition || (enquiry as any).patientHealthCondition
                });

                scoring.factors.intent = nlp.intent;
                scoring.factors.urgency = nlp.urgency;
                scoring.factors.summary = nlp.summary;

                await (prisma as any).automationScore.upsert({
                    where: {
                        entityId_module: {
                            entityId: enquiry.id,
                            module: "enquiry"
                        }
                    },
                    update: {
                        factors: scoring.factors
                    },
                    create: {
                        entityId: enquiry.id,
                        module: "enquiry",
                        tenantId: context.tenantId,
                        unitId: context.unitId,
                        score: scoring.score,
                        label: scoring.priority,
                        probability: scoring.probability,
                        confidence: 0.85,
                        factors: scoring.factors
                    }
                });

                const task = await createAITaskFromEnquiry(context.tenantId, context.unitId, {
                    enquiryId: enquiry.id,
                    title: nlp.summary,
                    description: enquiry.description || enquiry.rawMessage || nlp.summary,
                    type: nlp.intent.toUpperCase(),
                    priority: nlp.urgency,
                    aiSummary: nlp.summary,
                    aiUrgency: nlp.urgency
                });

                console.log("TASK CREATED:", task.id);

                const allocation = await this.allocate(context, {
                    taskId: task.id,
                    taskType: nlp.intent,
                    serviceId: enquiry.serviceId,
                    cityId: null,
                    unitId: context.unitId,
                    nlp
                });

                // 🚀 AUTO-CONVERSION LOGIC based on Multi-Factor follow-up data
                const clientInterest = payload.input?.clientInterest;
                const hasAttachment = payload.input?.hasAttachment;

                if (event === "ENQUIRY_FOLLOW_UP" && (
                    (nlp.intent as any) === "converted" ||
                    (nlp.sentiment as any) === "positive_high" ||
                    (clientInterest === "Very Interested" && hasAttachment) ||
                    (clientInterest === "Hot" && hasAttachment)
                )) {
                    console.log(`🚀 AI Detected HIGH Conversion Intent (Interest: ${clientInterest}, Attachment: ${hasAttachment}). Updating metrics...`);

                    // Update database status if it's a clear conversion or extremely high intent
                    if ((nlp.intent as any) === "converted" || (clientInterest === "Very Interested" && hasAttachment)) {
                        await (prisma as any).enquiry.update({
                            where: { id: enquiry.id, tenantId: context.tenantId },
                            data: {
                                status: 'CONVERTED',
                                isConverted: true,
                                convertedAt: new Date(),
                                remarks: `${enquiry.remarks || ''} [AI: Auto-Converted via Follow-up ${hasAttachment ? 'with Docs' : ''}]`.trim()
                            }
                        });
                    }

                    // Log to Learning Service
                    // @ts-ignore
                    await FeedbackLearningService.captureModuleFeedback({
                        tenantId: context.tenantId,
                        unitId: context.unitId,
                        module: 'enquiry',
                        entityId: enquiry.id,
                        event: 'AI_FOLLOWUP_CONVERSION_SIGNAL',
                        signals: {
                            conversionRate: 1,
                            intentStrength: 1
                        }
                    });
                }

                return { event, enquiryId: enquiry.id, scoring, nlp, task, allocation };
            }
            case "TASK_CREATED": {
                const taskId = payload.entityId || payload.taskId;
                const task = await (prisma as any).task.findFirst({
                    where: {
                        id: taskId,
                        tenantId: context.tenantId,
                        unitId: context.unitId,
                        isDeleted: false
                    }
                });

                if (task?.assignedStaffId || (task?.assigneeId && !payload.autoAllocate)) {
                    return { event, taskId, skipped: true };
                }

                return {
                    event,
                    taskId,
                    allocation: await this.allocate(context, {
                        taskId,
                        taskType: payload.taskType || payload.type
                    })
                };
            }
            case "INVOICE_CREATED": {
                return {
                    event,
                    forecast: await this.buildForecast(context, payload.options || {})
                };
            }
            default:
                return { event, skipped: true };
        }
    }

    private static async resolveMessageFromEntity(context: TenantContext, payload: NLPPayload) {
        if (payload.enquiryId) {
            const enquiry = await (prisma as any).enquiry.findFirst({
                where: {
                    id: payload.enquiryId,
                    tenantId: context.tenantId,
                    unitId: context.unitId
                },
                select: {
                    rawMessage: true,
                    description: true
                }
            });
            return enquiry?.rawMessage || enquiry?.description || "";
        }

        if (payload.complaintId) {
            const complaint = await (prisma as any).complaint.findFirst({
                where: {
                    id: payload.complaintId,
                    tenantId: context.tenantId,
                    unitId: context.unitId
                },
                select: {
                    description: true
                }
            });
            return complaint?.description || "";
        }

        return "";
    }
}
