import { ScoringEngine } from './ScoringEngine.js';
import { RuleEngine } from './RuleEngine.js';
import { WorkflowEngine } from './WorkflowEngine.js';
import { AutoActionEngine } from './AutoActionEngine.js';
import { AgentManager } from './AgentManager.js';
import { FollowUpEngine } from './FollowUpEngine.js';
import { AllocationEngine } from './AllocationEngine.js';
import { ModuleRegistry } from './DecisionLogic.js';
import type { DecisionContext } from './DecisionLogic.js';
import { addAutomationJob } from '../queue/queue.js';
import { emitAutomationUpdate } from '../../shared/services/socket.js';
// @ts-ignore
import { AiService } from '../../intelligence/services/ai.service.js';
import { RevenueForecastService } from '../../modules/revenue/revenueForecast.service.js';
import { prisma } from '../../app/prisma.js';
import { AIDecisionService } from '../../modules/ai/service.js';

export class TriggerEngine {
    /**
     * 🔹 PUBLIC ENTRY → Push event to queue
     */
    static async processEvent(
        tenantId: string,
        unitId: string,
        module: string,
        event: string,
        entityId: string,
        data: any,
        source: string = 'system',
        channelId?: string,
        eventId?: string
    ) {
        const jobId = eventId || `${unitId}-${module}-${entityId}-${Date.now()}`;

        console.log("📨 Event queued:", { jobId, module, event });

        await addAutomationJob({
            eventId: jobId,
            tenantId,
            unitId,
            module,
            event,
            entityId,
            input: data,
            source,
            channelId
        });

        return { queued: true, jobId };
    }

    /**
     * 🔹 WORKER EXECUTION → Core automation pipeline
     */
    static async processEventAsync(jobData: any): Promise<any> {
        const tenantId = jobData.tenantId || jobData._context?.tenantId;
        const unitId = jobData.unitId || jobData._context?.unitId;
        const { module, event, entityId, input, source, channelId } = jobData;

        // 🔥 FIX 3: FORCE CONTEXT EVERYWHERE
        if (!tenantId || !unitId) {
            throw new Error("❌ Missing tenant context in event");
        }

        if (["ENQUIRY_CREATED", "ENQUIRY_FOLLOW_UP", "TASK_CREATED", "INVOICE_CREATED"].includes(event)) {
            await AIDecisionService.processEvent({
                tenantId,
                unitId,
                userId: jobData.userId || jobData._context?.userId || null
            }, event, {
                ...jobData,
                entityId
            });
        }

        try {
            console.log("🚀 Running ScoringEngine...");

            // ============================================================
            // 1️⃣ FETCH ACTIVE RULES
            // ============================================================
            const rules = await prisma.automationRule.findMany({
                where: {
                    tenantId,
                    unitId,
                    module,
                    status: true
                },
                orderBy: { priority: 'asc' }
            });

            console.log(`🔍 Found ${rules.length} active rules for ${module}`);

            // ============================================================
            // 2️⃣ EVALUATE RULES & CAPTURE TRACE
            // ============================================================
            const evaluationContext = { input, module, event };
            const triggeredRules = [];
            const trace: any = {
                rules: [],
                timestamps: { started: new Date().toISOString() }
            };

            for (const rule of rules) {
                const isTriggered = RuleEngine.evaluate(rule.conditions, evaluationContext);

                trace.rules.push({
                    name: rule.name,
                    matched: isTriggered,
                    action: rule.action,
                    scoreContribution: isTriggered && rule.action === 'add_score'
                        ? Number(rule.actionValue || 0)
                        : 0
                });

                if (isTriggered) {
                    triggeredRules.push(rule);
                }
            }

            // ============================================================
            // 3️⃣ AI INTELLIGENCE LAYER (Phase 1)
            // ============================================================
            let aiResult: any = {};
            const textToAnalyze = typeof input === 'string' ? input : (input?.description || input?.comments || "");

            if (module === 'enquiry' && textToAnalyze) {
                console.log("🤖 Triggering AI Analysis for Enquiry...");
                const analysis = await AiService.analyzeText(textToAnalyze, "Analyze this lead enquiry for urgency, sentiment, and core request.");

                // Map AI result to scoring inputs
                aiResult = {
                    aiScore: analysis.urgency === 'HIGH' ? 30 : (analysis.urgency === 'MEDIUM' ? 15 : 0),
                    aiLabel: analysis.urgency,
                    reasoning: `AI detected ${analysis.urgency} urgency based on customer sentiment.`
                };
            }

            // ============================================================
            // 4️⃣ CALCULATE & PERSIST SCORE (Single Source of Truth)
            // ============================================================
            const scoreResult = await ScoringEngine.calculateScore({
                tenantId: tenantId,
                unitId: unitId,
                module: "enquiry",
                entityId: entityId,
                input: input,
                triggeredRules,
                additionalData: aiResult
            });

            console.log("📊 SCORE RESULT:", scoreResult);

            trace.finalScore = scoreResult.score;
            trace.label = scoreResult.label;
            trace.timestamps.completed = new Date().toISOString();

            // ============================================================
            // 4️⃣ CONSTRUCT UNIVERSAL DECISION CONTEXT
            // ============================================================
            const decisionContext: DecisionContext = {
                entityType: module,
                entityId,
                module,
                input,
                computed: {
                    score: scoreResult.score,
                    label: scoreResult.label,
                    priority: scoreResult.label, // Default label as priority
                    anomalies: [] // Future: Anomaly detection logic
                },
                meta: {
                    tenantId,
                    unitId,
                    timestamp: new Date()
                },
                actions: []
            };

            // ============================================================
            // 4️⃣ TRIGGER SIDE EFFECTS (Real-time & Audit)
            // ============================================================
            console.log("🎯 FINAL DECISION:", {
                entityId,
                score: scoreResult.score,
                label: scoreResult.label,
                triggeredRulesCount: triggeredRules.length
            });

            // 🔹 Evolution: Real-time UI Update + Predictive engagement
            const strategy = (module === 'enquiry')
                ? await FollowUpEngine.getBestStrategy(tenantId)
                : null;

            if (strategy) {
                decisionContext.computed.prediction = {
                    bestTime: `${strategy.bestHour}:00`,
                    bestChannel: strategy.bestChannel
                };
            }

            // Check if allocation happened (for enquiry module)
            const allocation = (module === 'enquiry')
                ? await (prisma.allocation as any).findUnique({
                    where: { enquiryId: entityId },
                    include: { staff: { select: { id: true, firstName: true, lastName: true, userId: true } } }
                })
                : null;

            emitAutomationUpdate({
                tenantId,
                unitId,
                entityId,
                score: scoreResult.score,
                label: scoreResult.label,
                priority: scoreResult.label,
                prediction: decisionContext.computed.prediction,
                assignedStaff: allocation?.staff ? `${allocation.staff.firstName} ${allocation.staff.lastName || ''}` : undefined,
                allocationScore: allocation?.allocationScore || undefined
            });

            // ============================================================
            // 5️⃣ PERSIST TO AUTOMATION LOG (Historical Data)
            // ============================================================
            try {
                if (!tenantId || !unitId) {
                    console.warn("⚠️ Skipping DB write: missing context");
                } else {
                    await (prisma.automationLog as any).create({
                        data: {
                            tenantId,
                            unitId,
                            module,
                            event,
                            entityId,
                            score: scoreResult.score,
                            label: scoreResult.label,
                            triggeredRules: trace.rules,
                            payload: input,
                            traceData: {
                                rules: trace.rules,
                                finalScore: scoreResult.score,
                                label: scoreResult.label,
                                factors: scoreResult.breakdown,
                                actions: decisionContext.actions || [],
                                timestamps: trace.timestamps
                            }
                        }
                    });
                    console.log("Trace saved");
                }
            } catch (err) {
                console.error("⚠️ DB write failed (automationLog):", err);
            }

            // ============================================================
            // 8️⃣ AGENT-DRIVEN DECISION HANDLING (Allocate First)
            // ============================================================
            await AgentManager.handleDecision(decisionContext);

            // ============================================================
            // 7️⃣ AUTO-ACTION INTELLIGENCE (Target Allocated Staff)
            // ============================================================
            await AutoActionEngine.triggerActions(
                tenantId,
                unitId,
                module,
                entityId,
                scoreResult.score,
                allocation?.staff?.userId || undefined
            );

            // ============================================================
            // 9️⃣ REVENUE INTELLIGENCE (Phase 2)
            // ============================================================
            if (module === 'enquiry') {
                // Fire and forget (don't block main automation flow)
                RevenueForecastService.updateForecast(tenantId, unitId).catch(err =>
                    console.error("⚠️ Revenue Forecast Hook Error:", err)
                );
            }

            return decisionContext;

        } catch (error) {
            console.error("❌ TriggerEngine Error:", error);
            throw error;
        }
    }
}
