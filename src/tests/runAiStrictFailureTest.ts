import { analyzeNLP } from "../modules/ai/nlp.service";

async function run() {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
        await analyzeNLP("Need urgent help");
        throw new Error("Expected analyzeNLP to fail without GEMINI_API_KEY");
    } catch (error: any) {
        if (!String(error?.message || "").includes("GEMINI_API_KEY")) {
            throw error;
        }
        console.log("Strict failure test passed:", error.message);
    } finally {
        if (original) process.env.GEMINI_API_KEY = original;
    }
}

run().catch(console.error);
