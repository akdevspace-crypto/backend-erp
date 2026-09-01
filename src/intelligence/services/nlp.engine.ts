import { analyzeNLP } from "../../modules/ai/nlp.service.js";

export class NLPEngine {
    static async processMessage(content: string) {
        console.log(`NLP processing message: ${content.substring(0, 50)}...`);
        return analyzeNLP(content);
    }
}
