import { sendWhatsAppMessage } from "../../outbound/outbound.service.js";
// @ts-ignore
import { prisma as sharedPrisma } from "../../app/prisma.js";

export class ScoringEngine {

    /**
     * 🔹 Central classification logic (single source of truth)
     */
    static classifyScore(module: string, score: number): string {
        switch (module) {
            case "accounts":
                if (score >= 90) return "ANOMALY";
                if (score >= 70) return "HIGH_RISK";
                if (score >= 40) return "MEDIUM_RISK";
                return "LOW_RISK";

            case "hr":
                if (score >= 80) return "CRITICAL_RISK";
                if (score >= 50) return "RISK";
                return "STABLE";

            case "complaint":
                if (score >= 80) return "URGENT";
                if (score >= 60) return "HIGH";
                if (score >= 30) return "MEDIUM";
                return "LOW";

            case "enquiry":
            default:
                if (score >= 80) return "HOT";
                if (score >= 50) return "WARM";
                return "COLD";
                return "COLD";
        }
    }

    /**
     * 🔹 Calculate score based on triggered rules
     */
    static async calculateScore({
        tenantId,
        unitId,
        module,
        entityId,
        input,
        triggeredRules,
        additionalData = {}
    }: {
        tenantId: string,
        unitId: string,
        module: string,
        entityId: string,
        input: any,
        triggeredRules: any[],
        additionalData?: { aiScore?: number, aiLabel?: string, reasoning?: string }
    }) {
        // ============================================================
        // 🔹 TRACE & VALIDATION
        // ============================================================
        if (!tenantId || !unitId) {
            console.warn("📍 TRACE: Scoring Skipped - Missing Context", { module, entityId });
            return { score: 0, label: "COLD", breakdown: [] };
        }

        console.log("🧠 Scoring started for:", entityId);

        let score = 0;
        const breakdown: any[] = [];

        // ============================================================
        // 1️⃣ CALCULATE SCORE
        // ============================================================
        for (const rule of triggeredRules) {
            if (rule.action === "add_score") {
                const weight = (rule.performanceWeight && rule.performanceWeight > 0)
                    ? rule.performanceWeight
                    : Number(rule.actionValue || 0);

                score += weight;
                breakdown.push({
                    ruleId: rule.id,
                    ruleName: rule.name || "Unnamed Rule",
                    score: weight,
                    isDynamic: !!(rule.performanceWeight && rule.performanceWeight > 0)
                });
            }
        }

        if (additionalData.aiScore) {
            score += additionalData.aiScore;
            breakdown.push({
                ruleName: "AI Analysis (Gemini)",
                score: additionalData.aiScore,
                isAI: true,
                reasoning: additionalData.reasoning
            });
        }

        if (score > 100) score = 100;

        // ============================================================
        // 2️⃣ CALCULATE PROBABILITY & CONFIDENCE
        // ============================================================
        let totalConversionRate = 0;
        let rulesWithPerformance = 0;

        for (const rule of triggeredRules) {
            if (rule.conversionRate !== undefined) {
                totalConversionRate += rule.conversionRate;
                rulesWithPerformance++;
            }
        }

        const probability = rulesWithPerformance > 0 ? (totalConversionRate / rulesWithPerformance) : 0;
        const confidence = additionalData.aiScore ? 0.9 : (rulesWithPerformance > 0 ? 0.7 : 0.4);

        // ============================================================
        // 3️⃣ CLASSIFY SCORE
        // ============================================================
        const label = this.classifyScore(module, score);

        // ============================================================
        // 4️⃣ UPSERT (Unified Storage)
        // ============================================================
        try {
            const scoreData = {
                tenantId,
                unitId,
                module: "enquiry",
                entityId,
                score,
                label,
                factors: breakdown,
                confidence: 0.9
            };

            await sharedPrisma.automationScore.upsert({
                where: {
                    entityId_module: {
                        entityId,
                        module: "enquiry"
                    }
                },
                update: scoreData,
                create: scoreData
            });
            console.log("💾 Score saved:", entityId);
        } catch (dbError) {
            console.error("❌ DB WRITE FAILED (AutomationScore):", dbError);
            // Continue execution, don't crash the engine
        }

        // ============================================================
        // 🔹 AUTOMATION TRIGGER: OMNICHANNEL OUTBOUND
        // ============================================================
        if (label === "HOT" && module === "enquiry") {
            try {
                // Fetch enquiry and client to get contact details
                const enquiry = await sharedPrisma.enquiry.findUnique({
                    where: { id: entityId },
                    include: { client: true }
                });

                if (enquiry && enquiry.client && enquiry.client.mobile) {
                    await sendWhatsAppMessage({
                        phone: enquiry.client.mobile,
                        message: `Hello ${enquiry.client.name}, thank you for your enquiry (Ref: ${enquiry.refNo}). We will contact you shortly!`,
                        tenantId,
                        unitId,
                        entityId,
                        entityType: "enquiry"
                    });
                }
            } catch (triggerError) {
                console.error("⚠️ Failed to trigger outbound message:", triggerError);
                // Don't throw, just log. Scoring should still succeed.
            }
        }

        // ============================================================
        // 4️⃣ RETURN RESULT
        // ============================================================
        return {
            score,
            label,
            breakdown
        };
    }
}