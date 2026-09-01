import { prisma } from '../../app/prisma.js';

export class AnomalyEngine {
    static async detectTransactionAnomaly(tenantId: string, unitId: string, data: any) {
        console.log(`🔍 AI Anomaly Engine: Analyzing transaction for tenant ${tenantId}...`);

        const anomalies = [];
        const amount = Math.abs(Number(data.amount));
        const category = data.category;
        const type = data.type; // RECEIPT or EXPENSE

        try {
            // 1. Outlier Detection (3x average for category)
            const recentStats = await (prisma.accountTransaction as any).aggregate({
                _avg: { amount: true },
                where: {
                    tenantId,
                    unitId,
                    category,
                    type,
                    status: 'POSTED'
                }
            });

            const avg = Math.abs(recentStats._avg.amount || 0);
            if (avg > 0 && amount > avg * 3) {
                anomalies.push({
                    type: 'OUTLIER',
                    severity: 'HIGH',
                    message: `Transaction amount (₹${amount}) is significantly higher than category average (₹${avg.toFixed(2)})`
                });
            }

            // 2. Duplicate Detection (Same amount, category, date)
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const duplicates = await (prisma.accountTransaction as any).findMany({
                where: {
                    tenantId,
                    unitId,
                    amount: data.amount, // Exact amount match (negative for expenses)
                    category,
                    date: { gte: today },
                    isDeleted: false
                }
            });

            if (duplicates.length > 0) {
                anomalies.push({
                    type: 'DUPLICATE',
                    severity: 'MEDIUM',
                    message: `Potential duplicate transaction detected today for ₹${amount}`
                });
            }

            // 3. Frequency Check (Too many transactions in 1 hour)
            const oneHourAgo = new Date(Date.now() - 3600000);
            const frequency = await (prisma.accountTransaction as any).count({
                where: {
                    tenantId,
                    unitId,
                    createdAt: { gte: oneHourAgo }
                }
            });

            if (frequency > 5) {
                anomalies.push({
                    type: 'BURST',
                    severity: 'LOW',
                    message: `High volume of transactions detected in the last hour (${frequency})`
                });
            }

            return {
                isAnomaly: anomalies.length > 0,
                anomalies,
                score: anomalies.length > 0 ? 30 : 0 // Penalty score
            };

        } catch (error) {
            console.error('❌ Anomaly Engine Error:', error);
            return { isAnomaly: false, anomalies: [], score: 0 };
        }
    }
}
