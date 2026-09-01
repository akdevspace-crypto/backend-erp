import { prisma } from "../../app/prisma.js";

function startOfDay(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

export class RevenueForecastService {
    static async buildForecast(tenantId, unitId, options = {}) {
        const horizonDays = Number(options.horizonDays || 30);
        const lookbackDays = Number(options.lookbackDays || 90);
        const end = startOfDay(new Date());
        const start = new Date(end);
        start.setDate(start.getDate() - lookbackDays);

        const transactions = await prisma.accountTransaction.findMany({
            where: {
                tenantId,
                unitId,
                type: { in: ["INVOICE", "RECEIPT"] },
                date: { gte: start, lte: end },
                isDeleted: false
            },
            orderBy: { date: "asc" }
        });

        const recentScores = await prisma.automationScore.findMany({
            where: { tenantId, unitId, module: "enquiry" },
            orderBy: { updatedAt: "desc" },
            take: 100
        });

        const totalRevenue = transactions.reduce((sum, item) => sum + Math.max(Number(item.amount || 0), 0), 0);
        const dailyAverage = lookbackDays ? totalRevenue / lookbackDays : 0;
        const monthlyBaseline = dailyAverage * 30;

        const hotValue = recentScores
            .filter((item) => item.label === "HOT")
            .reduce((sum, item) => sum + (Number(item.probability || item.score || 0) * 25), 0);
        const warmValue = recentScores
            .filter((item) => item.label === "WARM")
            .reduce((sum, item) => sum + (Number(item.probability || item.score || 0) * 10), 0);

        const pipelineRevenue = hotValue + warmValue;
        const previousWindowStart = new Date(start);
        previousWindowStart.setDate(previousWindowStart.getDate() - lookbackDays);
        const previousTransactions = await prisma.accountTransaction.findMany({
            where: {
                tenantId,
                unitId,
                type: { in: ["INVOICE", "RECEIPT"] },
                date: { gte: previousWindowStart, lt: start },
                isDeleted: false
            }
        });

        const previousRevenue = previousTransactions.reduce((sum, item) => sum + Math.max(Number(item.amount || 0), 0), 0);
        const growthRate = previousRevenue > 0 ? (totalRevenue - previousRevenue) / previousRevenue : 0;
        const projectedRevenue = Number((monthlyBaseline * (1 + growthRate) + pipelineRevenue).toFixed(2));
        const confidence = Math.max(0.25, Math.min(0.95, transactions.length / Math.max(lookbackDays, 1)));
        const periodEnd = new Date(end);
        periodEnd.setDate(periodEnd.getDate() + horizonDays);

        return prisma.revenueForecast.create({
            data: {
                tenantId,
                unitId,
                forecastDate: end,
                periodStart: end,
                periodEnd,
                scope: options.scope || "MONTHLY",
                projectedRevenue,
                baselineRevenue: Number(monthlyBaseline.toFixed(2)),
                pipelineRevenue: Number(pipelineRevenue.toFixed(2)),
                growthRate: Number(growthRate.toFixed(4)),
                confidence: Number(confidence.toFixed(2)),
                contributingData: {
                    lookbackDays,
                    horizonDays,
                    transactionCount: transactions.length,
                    hotLeadCount: recentScores.filter((item) => item.label === "HOT").length,
                    warmLeadCount: recentScores.filter((item) => item.label === "WARM").length
                },
                reasoning: `Forecast blends a ${lookbackDays}-day baseline with pipeline-weighted enquiry probability and ${(growthRate * 100).toFixed(1)}% growth.`
            }
        });
    }

    static async getLatestForecast(tenantId, unitId) {
        return prisma.revenueForecast.findFirst({
            where: { tenantId, unitId },
            orderBy: { createdAt: "desc" }
        });
    }
}
