import { AiService } from "./ai.service.js";

export class ComplaintIntelligenceService {
    static async analyzeComplaint({ title = "", description = "" }) {
        const source = `Title: ${title}\nDescription: ${description}`;

        const prompt = `
            Analyze the following ERP complaint and categorize it.
            JSON Format: { "sentiment": "positive" | "neutral" | "negative", "urgency": "LOW" | "MEDIUM" | "HIGH", "serviceTag": "medical" | "billing" | "staffing" | "support" | "general", "confidence": number }
        `;

        try {
            const analysis = await AiService.analyzeText(source, prompt);
            return {
                sentiment: analysis.sentiment || "neutral",
                urgency: analysis.urgency || "LOW",
                serviceTag: analysis.serviceTag || "general",
                confidence: analysis.confidence || 0.8
            };
        } catch (error) {
            console.error("LLM Complaint Analysis failed:", error.message);
            return {
                sentiment: "neutral",
                urgency: "LOW",
                serviceTag: "general",
                confidence: 0
            };
        }
    }
}
