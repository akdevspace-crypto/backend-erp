import { GoogleGenAI } from "@google/genai";

export type NLPIntent = "enquiry" | "complaint" | "support" | "emergency" | "converted";
export type NLPSentiment = "positive" | "neutral" | "negative" | "positive_high";
export type NLPUrgency = "LOW" | "MEDIUM" | "HIGH";

export type NLPAnalysis = {
    intent: NLPIntent;
    sentiment: NLPSentiment;
    summary: string;
    urgency: NLPUrgency;
    service: "GEMINI";
    tokens: number;
};

type RawNLPResponse = Partial<{
    intent: string;
    sentiment: string;
    summary: string;
    urgency: string;
}>;

type GeminiApiError = Error & {
    status?: number;
};

const getApiKey = () => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is required for Gemini NLP.");
    }

    return apiKey;
};

const createClient = () => new GoogleGenAI({ apiKey: getApiKey() });

const safeJsonParse = (value: string): RawNLPResponse => {
    const cleaned = value.replace(/```json|```/gi, "").trim();
    return JSON.parse(cleaned) as RawNLPResponse;
};

const normalizeIntent = (intent?: string): NLPIntent => {
    const value = String(intent || "").toLowerCase();
    if (value.includes("emergency") || value.includes("urgent")) return "emergency";
    if (value.includes("complaint")) return "complaint";
    if (value.includes("support")) return "support";
    if (value.includes("converted") || value.includes("admission") || value.includes("ready")) return "converted";
    return "enquiry";
};

const normalizeSentiment = (sentiment?: string): NLPSentiment => {
    const value = String(sentiment || "").toLowerCase();
    if (value.includes("negative")) return "negative";
    if (value.includes("high") && value.includes("positive")) return "positive_high";
    if (value.includes("positive")) return "positive";
    return "neutral";
};

const normalizeUrgency = (urgency?: string, message = ""): NLPUrgency => {
    const value = String(urgency || "").toLowerCase();
    const source = `${value} ${message}`.toLowerCase();
    if (/(high|urgent|emergency|critical|immediate|asap)/i.test(source)) return "HIGH";
    if (/(medium|soon|priority|important|support)/i.test(source)) return "MEDIUM";
    return "LOW";
};

const buildSummary = (summary: string | undefined, message: string) => {
    const trimmed = String(summary || "").trim();
    if (trimmed) return trimmed.slice(0, 200);
    return message.trim().slice(0, 200);
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (error: unknown) => {
    const status = (error as GeminiApiError)?.status;
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
};

const buildNlpError = (error: unknown) => {
    const status = (error as GeminiApiError)?.status;
    if (status === 429) {
        const wrapped = new Error("Gemini NLP quota exceeded. Check billing/quota for GEMINI_API_KEY and retry.") as GeminiApiError;
        wrapped.status = 503;
        return wrapped;
    }

    const wrapped = new Error(`Gemini NLP request failed: ${(error as Error)?.message || "Unknown error"}`) as GeminiApiError;
    wrapped.status = status || 502;
    return wrapped;
};

export const analyzeNLP = async (message: string): Promise<NLPAnalysis> => {
    const input = String(message || "").trim();
    if (!input) {
        throw new Error("Message is required for NLP analysis.");
    }

    console.log("AI INPUT:", input);

    const ai = createClient();
    const prompt = `
Extract the following from the text:
- intent (enquiry | complaint | support | emergency | converted)
- sentiment (positive | neutral | negative | positive_high)
- summary (short)
- urgency (LOW | MEDIUM | HIGH)

Text: ${input}

Return ONLY valid JSON.
`;

    try {
        let lastError: unknown;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const response = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                intent: {
                                    type: "STRING",
                                    enum: ["enquiry", "complaint", "support", "emergency", "converted"]
                                },
                                sentiment: {
                                    type: "STRING",
                                    enum: ["positive", "neutral", "negative", "positive_high"]
                                },
                                summary: { type: "STRING" },
                                urgency: {
                                    type: "STRING",
                                    enum: ["LOW", "MEDIUM", "HIGH"]
                                }
                            },
                            required: ["intent", "sentiment", "summary", "urgency"]
                        }
                    }
                });

                const parsed = safeJsonParse(response.text || "{}");

                const result = {
                    intent: normalizeIntent(parsed.intent),
                    sentiment: normalizeSentiment(parsed.sentiment),
                    summary: buildSummary(parsed.summary, input),
                    urgency: normalizeUrgency(parsed.urgency, input),
                    service: "GEMINI" as const,
                    tokens: input.split(/\s+/).filter(Boolean).length
                };

                console.log("AI OUTPUT:", result);
                return result;
            }
            catch (error) {
                lastError = error;
                if (!shouldRetry(error) || attempt === 2) {
                    throw error;
                }

                await sleep(1000 * (attempt + 1));
            }
        }

        throw lastError;
    } catch (error) {
        throw buildNlpError(error);
    }
};
