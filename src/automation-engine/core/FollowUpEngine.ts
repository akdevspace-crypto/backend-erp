import { prisma } from "../../app/prisma.js";

export class FollowUpEngine {
    /**
     * 🔹 Determine the best engagement strategy (Time & Channel) based on history
     */
    static async getBestStrategy(tenantId: string) {
        console.log(`🤖 FollowUpEngine: Analyzing engagement patterns for tenant ${tenantId}...`);

        try {
            // 1️⃣ Fetch historical follow-ups where leads responded or converted
            const historicalData = await (prisma.followUp as any).findMany({
                where: {
                    tenantId,
                    OR: [
                        { response: true },
                        { converted: true }
                    ]
                },
                select: {
                    scheduledAt: true,
                    channel: true
                }
            });

            if (!historicalData || historicalData.length === 0) {
                // DEFAULT STRATEGY (if no data)
                console.log("ℹ️ No historical data found. Using default strategy: CALL @ 10 AM");
                return {
                    bestChannel: "CALL",
                    bestHour: 10,
                    confidence: "LOW"
                };
            }

            // 2️⃣ Aggregate patterns (Hour + Channel)
            const patterns: Record<string, number> = {};

            for (const item of historicalData) {
                if (!item.scheduledAt) continue;

                const hour = new Date(item.scheduledAt).getHours();
                const key = `${item.channel}_${hour}`;

                patterns[key] = (patterns[key] || 0) + 1;
            }

            // 3️⃣ Find the "Winning" combination
            const sortedPatterns = Object.entries(patterns).sort((a, b) => b[1] - a[1]);
            const [bestKey, frequency] = sortedPatterns[0];
            const [channel, hour] = bestKey.split("_");

            console.log(`✅ Winning Pattern identified: ${channel} is most effective at hour ${hour} (${frequency} successes).`);

            return {
                bestChannel: channel,
                bestHour: Number(hour),
                confidence: historicalData.length > 20 ? "HIGH" : "MEDIUM"
            };

        } catch (error) {
            console.error("❌ FollowUpEngine Error:", error);
            // Fallback
            return { bestChannel: "WHATSAPP", bestHour: 11, confidence: "FALLBACK" };
        }
    }

    /**
     * 📅 Schedule an optimized follow-up
     */
    static async scheduleFollowUp(enquiryId: string, tenantId: string, unitId: string, leadScore: number) {
        const strategy = await this.getBestStrategy(tenantId);

        // Calculate day: Hot leads get follow-up today, others tomorrow
        const scheduledDate = new Date();
        if (leadScore < 70) {
            scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        scheduledDate.setHours(strategy.bestHour, 0, 0, 0);

        // Persist the recommendation
        const followup = await (prisma.followUp as any).create({
            data: {
                enquiryId,
                tenantId,
                unitId,
                channel: strategy.bestChannel,
                scheduledAt: scheduledDate,
                notes: `AI Recommended: ${strategy.bestChannel} at ${strategy.bestHour}:00 (Confidence: ${strategy.confidence})`
            }
        });

        console.log(`📅 Follow-up AUTO-SCHEDULED for Enquiry ${enquiryId} at ${scheduledDate.toLocaleString()}`);

        return followup;
    }
}
