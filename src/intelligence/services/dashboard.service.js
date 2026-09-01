import { prisma } from "../../app/prisma.js";
import { RevenueForecastService } from "./revenue-forecast.service.js";
import { getCache, setCache } from "../../shared/utils/redis.js";

export class DashboardService {
    static async getSummary(tenantId, unitId, page = 1, limit = 10) {
        const cacheKey = `dashboard:summary:${tenantId}:${unitId}:${page}:${limit}`;
        const cachedData = await getCache(cacheKey);

        if (cachedData) {
            console.log("🚀 Serving Dashboard Summary from Cache");
            return cachedData;
        }

        const skip = (page - 1) * limit;

        const [scores, followUps, staff, anomalies, latestForecast, transactions, complaints] = await Promise.all([
            prisma.automationScore.findMany({ where: { tenantId, unitId, module: "enquiry" }, skip, take: limit }),
            prisma.followUp.findMany({ where: { tenantId, unitId, isDeleted: false }, orderBy: { createdAt: "asc" } }),
            prisma.staff.findMany({ where: { tenantId, unitId, isDeleted: false } }),
            prisma.automationLog.findMany({
                where: { tenantId, unitId, module: "accounts", label: "ANOMALY" },
                orderBy: { createdAt: "desc" },
                take: 10
            }),
            RevenueForecastService.getLatestForecast(tenantId, unitId),
            prisma.accountTransaction.findMany({
                where: { tenantId, unitId, isDeleted: false },
                orderBy: { date: "desc" },
                take: 90
            }),
            prisma.complaint.findMany({ where: { tenantId, unitId, isDeleted: false }, orderBy: { createdAt: "asc" } })
        ]);

        const hot = scores.filter((item) => item.label === "HOT").length;
        const warm = scores.filter((item) => item.label === "WARM").length;
        const cold = scores.filter((item) => item.label === "COLD").length;
        const convertedFollowUps = followUps.filter((item) => item.converted).length;
        const responseCount = followUps.filter((item) => item.response).length;

        // 📈 Trend Analysis (Last 7 Days)
        const weeklyTrends = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            const dayStr = date.toISOString().split("T")[0];
            const dayName = date.toLocaleDateString("en-US", { weekday: "short" });

            return {
                name: dayName,
                leads: followUps.filter(f => f.createdAt.toISOString().startsWith(dayStr)).length,
                complaints: complaints.filter(c => c.createdAt.toISOString().startsWith(dayStr)).length,
                conversions: followUps.filter(f => f.converted && f.createdAt.toISOString().startsWith(dayStr)).length
            };
        });

        const summary = {
            conversionRate: followUps.length ? Number((convertedFollowUps / followUps.length).toFixed(2)) : 0,
            followUpResponseRate: followUps.length ? Number((responseCount / followUps.length).toFixed(2)) : 0,
            leadDistribution: { hot, warm, cold },
            weeklyTrends,
            staffPerformance: staff.map((member) => ({
                id: member.id,
                name: `${member.firstName} ${member.lastName || ""}`.trim(),
                score: member.performanceScore,
                workload: member.workload,
                stressLevel: member.stressLevel
            })),
            revenue: {
                income: Number(transactions.filter(t => t.type === 'INVOICE').reduce((acc, t) => acc + t.amount, 0).toFixed(2)),
                expense: Number(transactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.amount, 0).toFixed(2)),
                latestForecast
            },
            anomalies
        };

        // Cache for 5 minutes
        await setCache(cacheKey, summary, 300);

        return summary;
    }
}
