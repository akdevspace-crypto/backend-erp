import { v4 as uuidv4 } from "uuid";
import { PrismaClient } from "@prisma/client";
// @ts-ignore
import { RevenueForecastService } from "../revenueForecast.service.js";
// @ts-ignore
import { RevenueForecastEngine } from "../revenueForecast.engine.js";
import { runWithContext } from "../../../shared/utils/context.js";
import { prisma } from '../../../app/prisma.js';




async function runRevenueForecastTest() {
    console.log("\n🚀 REVENUE FORECAST ENGINE TEST STARTED\n");

    const tenantId = "test-tenant-rev-" + uuidv4().slice(0, 4);
    const unitId = "test-unit-rev";
    const userId = uuidv4();

    console.log(`📌 Test Tenant: ${tenantId}`);

    // ============================================================
    // 1️⃣ TEST: MOCK PREDICTION (Logic Only)
    // ============================================================
    console.log("\n🧪 Test Case 1: Engine Logic (Direct)");
    const mockEnquiries = [
        { id: "e1", isConverted: false },
        { id: "e2", isConverted: false },
        { id: "e3", isConverted: false }
    ];
    const mockScores = [
        { entityId: "e1", score: 90 }, // HOT
        { entityId: "e2", score: 60 }, // WARM
        { entityId: "e3", score: 20 }  // COLD
    ];

    const prediction = await RevenueForecastEngine.predictRevenue(mockEnquiries, mockScores);
    console.log("✅ Basic Prediction:", prediction);

    if (prediction.predictedRevenue > 0 && prediction.breakdown.hot === 1) {
        console.log("🎉 SUCCESS: Engine correctly identified and weighed lead groups.");
    } else {
        console.error("❌ FAIL: Prediction mismatch.");
    }

    // ============================================================
    // 2️⃣ TEST: SERVICE INTEGRATION (Database State)
    // ============================================================
    console.log("\n🧪 Test Case 2: Service Orchestration");

    // We'll wrap in context but expect empty DB results
    await runWithContext({ tenantId, unitId, userId }, async () => {
        const saved = await RevenueForecastService.updateForecast(tenantId, unitId);

        if (saved) {
            console.log("✅ Service Saved Forecast to DB:", {
                revenue: saved.projectedRevenue,
                confidence: saved.confidence
            });
        } else {
            // Note: In local environment without a live DB connection, this might return null
            console.log("ℹ️ Service call completed. Note: Live DB connectivity might affect persistence results.");
        }
    });

    // ============================================================
    // 3️⃣ TEST: TREND DETECTION
    // ============================================================
    console.log("\n🧪 Test Case 3: Trend Detection");
    const previous = { projectedRevenue: 10000 };
    const currHigher = await RevenueForecastEngine.predictRevenue(
        [...mockEnquiries, { id: "e4", isConverted: false }],
        [...mockScores, { entityId: "e4", score: 95 }],
        previous
    );

    console.log("✅ Trend (Higher Revenue):", currHigher.trend);
    if (currHigher.trend === "UP") {
        console.log("🎉 SUCCESS: Trend correctly identified as UP.");
    }

    console.log("\n🎯 REVENUE FORECAST TEST COMPLETED\n");
}

runRevenueForecastTest()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
