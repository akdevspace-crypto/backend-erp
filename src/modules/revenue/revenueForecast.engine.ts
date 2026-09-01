import type { LeadGroup, RevenueForecastResult, GroupStats, EngineConfig } from "./revenueForecast.types.js";

export class RevenueForecastEngine {
    private static config: EngineConfig = {
        defaultAvgRevenue: 5000,
        defaultRates: {
            HOT: 0.6,
            WARM: 0.3,
            COLD: 0.1
        }
    };

    /**
     * Core prediction method
     */
    static async predictRevenue(
        enquiries: any[],
        scores: any[],
        previousForecast?: any
    ): Promise<RevenueForecastResult> {
        console.log("🤖 RevenueForecastEngine: Running prediction...");

        // 1️⃣ Group Leads & Check Conversion Status
        const groups: Record<LeadGroup, { total: number; converted: number }> = {
            HOT: { total: 0, converted: 0 },
            WARM: { total: 0, converted: 0 },
            COLD: { total: 0, converted: 0 }
        };

        for (const enquiry of enquiries) {
            const scoreObj = scores.find(s => s.entityId === enquiry.id);
            const scoreValue = scoreObj ? scoreObj.score : 0; // Default to 0 if no score

            let group: LeadGroup = "COLD";
            if (scoreValue >= 80) group = "HOT";
            else if (scoreValue >= 50) group = "WARM";

            groups[group].total++;
            if (enquiry.isConverted) {
                groups[group].converted++;
            }
        }

        // 2️⃣ Compute Conversion Rates (with fallback)
        const activeLeads: Record<LeadGroup, number> = { HOT: 0, WARM: 0, COLD: 0 };
        const rates: Record<LeadGroup, number> = { ...this.config.defaultRates };

        for (const group of ["HOT", "WARM", "COLD"] as LeadGroup[]) {
            const stats = groups[group];

            // Actual rate from history
            if (stats.total > 5) { // Minimum sample size to trust history
                rates[group] = stats.converted / stats.total;
            }

            // Count only NON-converted leads for FUTURE prediction
            const nonConverted = enquiries.filter(e => {
                const s = scores.find(sc => sc.entityId === e.id);
                const val = s ? s.score : 0;
                let g: LeadGroup = "COLD";
                if (val >= 80) g = "HOT";
                else if (val >= 50) g = "WARM";
                return g === group && !e.isConverted;
            }).length;

            activeLeads[group] = nonConverted;
        }

        // 3️⃣ Average Revenue per Conversion
        const totalConverted = enquiries.filter(e => e.isConverted).length;
        const avgRevenue = this.config.defaultAvgRevenue; // Placeholder: real system would sum actual invoice values

        // 4️⃣ Prediction Formula: predictedRevenue = Σ (leads_in_group × conversionRate × avgRevenue)
        let predictedRevenue = 0;
        for (const group of ["HOT", "WARM", "COLD"] as LeadGroup[]) {
            predictedRevenue += (activeLeads[group] * rates[group] * avgRevenue);
        }

        // 5️⃣ Trend Detection
        let trend: "UP" | "DOWN" | "STABLE" = "STABLE";
        if (previousForecast) {
            const diff = predictedRevenue - previousForecast.projectedRevenue;
            if (Math.abs(diff) < 100) trend = "STABLE";
            else trend = diff > 0 ? "UP" : "DOWN";
        }

        // 6️⃣ Confidence Score
        const totalLeads = enquiries.length;
        const confidence = Math.min(100, Math.floor((totalLeads / 50) * 100)) || 20;

        return {
            predictedRevenue: Math.round(predictedRevenue),
            trend,
            confidence,
            breakdown: {
                hot: activeLeads.HOT,
                warm: activeLeads.WARM,
                cold: activeLeads.COLD
            }
        };
    }
}
