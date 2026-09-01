// @ts-ignore
import { RevenueForecastRepository } from "./revenueForecast.repository.js";
// @ts-ignore
import { RevenueForecastEngine } from "./revenueForecast.engine.js";
import { emitAutomationUpdate } from "../../shared/services/socket.js";

export class RevenueForecastService {
    /**
     * Compute and save a new forecast for a tenant/unit
     */
    static async updateForecast(tenantId: string, unitId: string) {
        try {
            console.log(`📡 Updating Revenue Forecast for [${tenantId}]...`);

            // 1️⃣ Fetch raw data
            const enquiries = await RevenueForecastRepository.getEnquiryStats(tenantId, unitId);
            const enquiryIds = enquiries.map((e: any) => e.id);
            const scores = await RevenueForecastRepository.getScoresForEnquiries(tenantId, unitId, enquiryIds);
            const latestForecast = await RevenueForecastRepository.getLatestForecast(tenantId, unitId);

            // 2️⃣ Run Engine
            const prediction = await RevenueForecastEngine.predictRevenue(enquiries, scores, latestForecast);

            // 3️⃣ Save results
            const saved = await RevenueForecastRepository.saveForecast(tenantId, unitId, prediction);

            // 4️⃣ Emit Event (Real-time updates)
            emitAutomationUpdate({
                type: "REVENUE_FORECAST_UPDATED",
                tenantId,
                unitId,
                data: prediction
            });

            return saved;
        } catch (error) {
            console.error("❌ RevenueForecastService Error:", error);
            // Non-blocking for principal transaction
            return null;
        }
    }
}
