import { prisma } from "../../app/prisma.js";

export class FeedbackLearningService {
    static async captureModuleFeedback({ tenantId, unitId, module, entityId, event, signals = {} }) {
        const responseRate = Number(signals.responseRate || 0);
        const conversionRate = Number(signals.conversionRate || 0);
        const completionRate = Number(signals.completionRate || 0);
        const optimizationScore = (responseRate * 0.35) + (conversionRate * 0.4) + (completionRate * 0.25);

        const feedback = await prisma.automationFeedback.create({
            data: {
                tenantId,
                unitId,
                module,
                entityId,
                event,
                responseRate,
                conversionRate,
                completionRate,
                optimizationScore,
                signals
            }
        });

        await this.recalculateRuleWeights(tenantId, unitId, module);
        return feedback;
    }

    static async recalculateRuleWeights(tenantId, unitId, module) {
        const rules = await prisma.automationRule.findMany({
            where: { tenantId, unitId, module, status: true }
        });

        for (const rule of rules) {
            const logs = await prisma.automationLog.findMany({
                where: {
                    tenantId,
                    unitId,
                    module,
                    triggeredRules: {
                        array_contains: rule.name
                    }
                },
                select: { entityId: true }
            });

            const entityIds = [...new Set(logs.map((item) => item.entityId))];
            if (!entityIds.length) continue;

            const feedbackRows = await prisma.automationFeedback.findMany({
                where: { tenantId, unitId, module, entityId: { in: entityIds } }
            });

            const triggerCount = entityIds.length;
            const conversionCount = feedbackRows.filter((item) => item.conversionRate >= 1).length;
            const avgOptimization = feedbackRows.length
                ? feedbackRows.reduce((sum, item) => sum + item.optimizationScore, 0) / feedbackRows.length
                : 0;
            const conversionRate = triggerCount ? conversionCount / triggerCount : 0;
            const baseWeight = Number(rule.baseWeight || rule.actionValue || 0);
            const performanceWeight = Number((baseWeight * (1 + avgOptimization)).toFixed(2));

            await prisma.automationRule.update({
                where: { id: rule.id },
                data: { triggerCount, conversionCount, conversionRate, performanceWeight }
            });
        }
    }
}
