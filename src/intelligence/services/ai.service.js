import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * AiService: Wrapper for Google Gemini LLM
 */
export class AiService {
    static getClient() {
        if (!process.env.GEMINI_API_KEY) {
            const error = new Error("GEMINI_API_KEY missing - AI disabled");
            error.status = 500;
            throw error;
        }

        return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    static async chatWithTools(query, tools, context = {}) {
        try {
            const response = await this.getClient().models.generateContent({
                model: "gemini-2.0-flash",
                contents: `System Context: You are an Intelligent ERP Assistant. You have access to tools to fetch real-time data. ${context.additional || ""}\n\nUser Query: ${query}`
            });

            return {
                answer: response.text,
                toolsCalled: [],
                data: null
            };
        } catch (error) {
            console.error("AiService Error:", error.message);
            throw error;
        }
    }

    static async analyzeText(text, prompt) {
        try {
            const result = await this.getClient().models.generateContent({
                model: "gemini-2.0-flash",
                contents: `${prompt}\n\nText: "${text}"\n\nReturn ONLY a JSON object.`,
                config: {
                    responseMimeType: "application/json"
                }
            });
            const responseText = result.text;
            const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleanJson);
        } catch (error) {
            console.error("AiService Analysis Error:", error.message);
            throw error;
        }
    }
}
