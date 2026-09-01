import { prisma } from "../../app/prisma.js";

export class AnalyticsEngine {
    /**
     * 🔹 Recalculate conversion rates and performance weights for all rules
     */
    static async updateRuleAnalytics(module: string = "enquiry") {
        console.log(`📊 Recalculating analytics for module: ${module}`);

        try {
            const rules = await prisma.automationRule.findMany({
                where: { module }
            });

            for (const rule of rules) {
                // Find all logs where this rule was triggered
                const logs = await prisma.automationLog.findMany({
                    where: {
                        module,
                        triggeredRules: {
                            path: [],
                            array_contains: rule.name
                        }
                    }
                });

                const triggerCount = logs.length;
                if (triggerCount === 0) continue;

                // Check conversions for these entities
                const entityIds = logs.map((l: any) => l.entityId);
                const conversions = await prisma.enquiry.count({
                    where: {
                        id: { in: entityIds },
                        isConverted: true
                    }
                });

                const conversionRate = conversions / triggerCount;

                // Adaptive weighting logic
                // Using a base weight (e.g., from actionValue) multiplied by the conversion rate
                const baseWeight = parseFloat(rule.actionValue || "0");
                const performanceWeight = baseWeight * conversionRate;

                await prisma.automationRule.update({
                    where: { id: rule.id },
                    data: {
                        triggerCount,
                        conversionCount: conversions,
                        conversionRate,
                        performanceWeight
                    }
                });

                console.log(`📈 Rule [${rule.name}] updated: Rate=${(conversionRate * 100).toFixed(1)}%, Weight=${performanceWeight.toFixed(2)}`);
            }

            console.log("🎯 Analytics update complete.");
        } catch (error) {
            console.error("❌ Analytics Update Failed:", error);
            throw error;
        }
    }
}
