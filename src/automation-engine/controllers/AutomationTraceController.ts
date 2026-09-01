import type { Request, Response } from "express";
import { prisma } from "../../app/prisma.js";
import { ScoringEngine } from "../../intelligence/services/scoring.engine.js";

const normalizeRulesFromFactors = (factors: any) => {
    if (Array.isArray(factors)) {
        return factors.map((factor, index) => ({
            name: factor?.ruleName || factor?.name || `Factor ${index + 1}`,
            matched: true,
            action: factor?.isAI ? "ai_analysis" : "add_score",
            scoreContribution: Number(factor?.score || 0)
        }));
    }

    if (factors && typeof factors === "object") {
        return Object.entries(factors).map(([key, value]) => ({
            name: key.replace(/_/g, " "),
            matched: true,
            action: "computed_factor",
            scoreContribution: Number(value || 0)
        }));
    }

    return [];
};

const buildTracePayload = ({
    score,
    label,
    rules,
    actions,
    started,
    completed
}: {
    score: number;
    label: string;
    rules: any[];
    actions?: string[];
    started: string;
    completed: string;
}) => {
    const safeRules = rules.length > 0
        ? rules
        : [{ name: "Baseline Score", matched: true, action: "base_score", scoreContribution: score }];

    return {
        rules: safeRules,
        finalScore: score,
        label,
        actions: Array.isArray(actions) ? actions : [],
        timestamps: {
            started,
            completed
        }
    };
};

export class AutomationTraceController {
    /**
     * Get execution trace for a specific entity.
     */
    static async getTrace(req: Request, res: Response) {
        try {
            const entityId = String(req.params.entityId);
            const module = String((req.query as any)?.module || "enquiry");
            const tenantId = (req as any).user?.tenantId;
            const unitId = (req as any).user?.unitId;

            console.log(`Fetching trace for entity: ${entityId}`);

            const log = await (prisma.automationLog as any).findFirst({
                where: {
                    entityId,
                    module,
                    ...(tenantId ? { tenantId } : {}),
                    ...(unitId ? { unitId } : {})
                },
                orderBy: { createdAt: "desc" }
            });

            if (log) {
                const traceData = (log.traceData || {}) as any;
                const rawRules = Array.isArray(traceData.rules) ? traceData.rules : normalizeRulesFromFactors(traceData.factors || log.triggeredRules);

                const startedAt = traceData?.timestamps?.started || new Date(log.createdAt).toISOString();
                const completedAt = traceData?.timestamps?.completed || traceData?.timestamps?.ended || new Date(log.createdAt).toISOString();

                const payload = buildTracePayload({
                    score: Number(traceData.finalScore ?? traceData.score ?? log.score ?? 0),
                    label: String(traceData.label ?? log.label ?? "COLD"),
                    rules: rawRules,
                    actions: traceData.actions,
                    started: startedAt,
                    completed: completedAt
                });

                return res.json({ success: true, data: payload });
            }

            // Fallback for historical rows: synthesize trace from automationScore and compute if missing.
            let scoreRecord = await (prisma.automationScore as any).findUnique({
                where: { entityId_module: { entityId, module } }
            });

            if (!scoreRecord && module === "enquiry") {
                await ScoringEngine.calculateScore(entityId, module, { tenantId, unitId });
                scoreRecord = await (prisma.automationScore as any).findUnique({
                    where: { entityId_module: { entityId, module } }
                });
            }

            if (!scoreRecord) {
                return res.json({
                    success: true,
                    data: null,
                    message: "No trace found for this entity"
                });
            }

            const payload = buildTracePayload({
                score: Number(scoreRecord.score || 0),
                label: String(scoreRecord.label || "COLD"),
                rules: normalizeRulesFromFactors(scoreRecord.factors),
                actions: [],
                started: new Date(scoreRecord.createdAt).toISOString(),
                completed: new Date(scoreRecord.updatedAt).toISOString()
            });

            return res.json({ success: true, data: payload, message: "Generated trace from score factors" });
        } catch (error) {
            console.error("Error fetching trace:", error);
            return res.status(500).json({ error: "Failed to fetch execution trace" });
        }
    }
}
