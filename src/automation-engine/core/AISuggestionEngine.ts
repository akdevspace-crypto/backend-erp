import { prisma } from "../../app/prisma.js";

export class AISuggestionEngine {
    /**
     * 🔹 Analyze conversion patterns and suggest new rules
     */
    static async generateSuggestions(module: string = "enquiry") {
        console.log(`🤖 AI Suggestion Engine starting for module: ${module}`);

        try {
            // Fetch all converted enquiries
            const converted = await prisma.enquiry.findMany({
                where: { isConverted: true },
                select: { id: true }
            });

            if (converted.length === 0) {
                console.log("ℹ️ Not enough conversion data to generate suggestions.");
                return;
            }

            // Find common attributes in converted leads via logs
            const entityIds = converted.map((c: any) => c.id);
            const logs = await prisma.automationLog.findMany({
                where: {
                    entityId: { in: entityIds },
                    module
                }
            });

            // Pattern analysis: Identify high-performing serviceType + enquiryMode combinations
            const patterns: Record<string, { count: number; payload: any }> = {};

            for (const log of logs) {
                const payload = log.payload as any;
                if (!payload) continue;

                const serviceType = payload.serviceType || "Unknown";
                const mode = payload.enquiryMode || "Unknown";
                const patternKey = `${serviceType}|${mode}`;

                if (!patterns[patternKey]) {
                    patterns[patternKey] = { count: 0, payload: { serviceType, mode } };
                }
                patterns[patternKey].count++;
            }

            // Generate suggestions for patterns with high frequency
            for (const [key, data] of Object.entries(patterns)) {
                if (data.count >= 5) { // Threshold for suggestion
                    const existing = await prisma.automationSuggestion.findFirst({
                        where: {
                            module,
                            conditions: {
                                path: [],
                                equals: [
                                    { field: "input.serviceType", operator: "=", value: data.payload.serviceType },
                                    { field: "input.enquiryMode", operator: "=", value: data.payload.mode }
                                ]
                            }
                        }
                    });

                    if (!existing) {
                        await prisma.automationSuggestion.create({
                            data: {
                                tenantId: "test-tenant", // In production, this would be scoped
                                unitId: "test-unit",
                                module,
                                conditions: [
                                    { field: "input.serviceType", operator: "=", value: data.payload.serviceType },
                                    { field: "input.enquiryMode", operator: "=", value: data.payload.mode }
                                ],
                                suggestedScore: 60,
                                confidence: 0.85,
                                reasoning: `Pattern detected: High conversion rate for ${data.payload.serviceType} via ${data.payload.mode} (${data.count} conversions).`
                            }
                        });
                        console.log(`✨ AI Suggestion created: ${key}`);
                    }
                }
            }

        } catch (error) {
            console.error("❌ AI Suggestion Engine Error:", error);
            throw error;
        }
    }
}
