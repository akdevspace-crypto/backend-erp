import { prisma } from "../../app/prisma.js";

export class AICopilotService {
    /**
     * 🔹 Generate natural language insights from automation data
     */
    static async generateInsights(module: string, tenantId: string) {
        console.log(`🤖 AI Copilot: Generating insights for ${module}...`);

        try {
            // 1️⃣ Fetch recent logs and conversions
            const logs = await prisma.automationLog.findMany({
                where: { module, tenantId },
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            const conversions = await (prisma.enquiry as any).count({
                where: { isConverted: true, tenantId }
            });

            // 2️⃣ Pattern Detection (Heuristic for now, LLM integration ready)
            const hotLeads = logs.filter((l: any) => (l as any).label === "HOT").length;
            const avgScore = logs.reduce((acc: any, current: any) => acc + ((current as any).score || 0), 0) / (logs.length || 1);

            // 3️⃣ Prompt construction (Integration point for OpenAI/Gemini)
            const insightTemplate = `
                Module: ${module}
                Sample Size: ${logs.length} events
                HOT Leads detected: ${hotLeads}
                Total Conversions: ${conversions}
                Average lead score: ${avgScore.toFixed(1)}
            `;

            // Simulation of LLM generated insight
            let generatedInsight = "";
            if (avgScore > 60) {
                generatedInsight = `Current ${module} performance is high. Detection of ${hotLeads} HOT leads suggests a strong pipeline. Focus on immediate conversions.`;
            } else {
                generatedInsight = `The ${module} module shows lower quality leads (Avg Score: ${avgScore.toFixed(1)}). Consider adjusting Rule Engine weights for 'In-House Care' services.`;
            }

            return {
                summary: generatedInsight,
                data: { hotLeads, conversions, avgScore }
            };

        } catch (error) {
            console.error("❌ AICopilotService Error:", error);
            throw error;
        }
    }
}
