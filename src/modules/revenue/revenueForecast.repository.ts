import { prisma } from "../../app/prisma.js";

export class RevenueForecastRepository {
    /**
     * Fetch enquiries with their automation scores for a given tenant/unit
     */
    static async getEnquiryStats(tenantId: string, unitId: string, days: number = 90) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        return (prisma as any).enquiry.findMany({
            where: {
                tenantId,
                unitId,
                createdAt: { gte: thresholdDate }
            },
            include: {
                // AutomationScore is typically a separate model joined via entityId
                // We'll manual join or check if relation exists in schema
            }
        });
    }

    /**
     * Get Automation Scores for a set of enquiry IDs
     */
    static async getScoresForEnquiries(tenantId: string, unitId: string, enquiryIds: string[]) {
        return (prisma as any).automationScore.findMany({
            where: {
                tenantId,
                unitId,
                module: "enquiry",
                entityId: { in: enquiryIds }
            }
        });
    }

    /**
     * Fetch all converted enquiries to compute average revenue
     */
    static async getConvertedEnquiryRevenue(tenantId: string, unitId: string) {
        // Since we don't have a concrete 'Invoice' model yet, we'll look for 
        // converted status and mock revenue if values are missing.
        // In a real system, we'd join with Transactions/Invoices.
        return (prisma as any).enquiry.findMany({
            where: {
                tenantId,
                unitId,
                isConverted: true
            },
            select: {
                id: true,
                // revenue field might not exist, we check schema
            }
        });
    }

    /**
     * Save the computed forecast
     */
    static async saveForecast(tenantId: string, unitId: string, data: any) {
        return (prisma as any).revenueForecast.create({
            data: {
                tenantId,
                unitId,
                forecastDate: new Date(),
                periodStart: new Date(),
                periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                projectedRevenue: data.predictedRevenue,
                baselineRevenue: 0,
                pipelineRevenue: data.predictedRevenue,
                growthRate: data.trend === "UP" ? 10 : (data.trend === "DOWN" ? -10 : 0),
                confidence: data.confidence,
                contributingData: data,
                reasoning: `Predicted based on ${data.breakdown.hot} HOT leads.`
            }
        });
    }

    /**
     * Get the most recent forecast for comparison
     */
    static async getLatestForecast(tenantId: string, unitId: string) {
        return (prisma as any).revenueForecast.findFirst({
            where: { tenantId, unitId },
            orderBy: { forecastDate: 'desc' }
        });
    }
}
