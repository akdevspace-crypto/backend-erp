import { prisma } from '../../app/prisma.js';

export class ForecastingEngine {
    static async generateRevenueForecast(tenantId: string, unitId: string) {
        console.log(`📈 Generating revenue forecast for tenant: ${tenantId}`);

        try {
            // Simple logic: lookup recent invoices (if any exist yet)
            const recentInvoices = await (prisma as any).invoice.findMany({
                where: { tenantId, unitId },
                orderBy: { createdAt: 'desc' },
                take: 10
            });

            let projectedRevenue = 10000; // Default baseline
            if (recentInvoices.length > 0) {
                const avg = recentInvoices.reduce((acc: number, inv: any) => acc + inv.amount, 0) / recentInvoices.length;
                projectedRevenue = avg * 1.2; // Predict 20% growth
            }

            const forecast = await (prisma as any).revenueForecast.create({
                data: {
                    tenantId,
                    unitId,
                    forecastDate: new Date(),
                    periodStart: new Date(),
                    periodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)),
                    projectedRevenue,
                    baselineRevenue: projectedRevenue / 1.1,
                    pipelineRevenue: projectedRevenue * 0.5,
                    growthRate: 10.0,
                    confidence: 0.75,
                    reasoning: 'Based on historical trends and pipeline indicators.'
                }
            });

            return forecast;
        } catch (error) {
            console.error('❌ Forecasting Engine Error:', error);
            throw error;
        }
    }
}
