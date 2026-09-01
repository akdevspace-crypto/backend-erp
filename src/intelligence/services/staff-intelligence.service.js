import { prisma } from "../../app/prisma.js";

/**
 * StaffIntelligenceService: Manages staff performance scores and stress levels
 */
export class StaffIntelligenceService {
    /**
     * 🔹 Recalculate metrics for a staff member
     */
    static async updateStaffIntelligence(userId) {
        const staff = await prisma.staff.findUnique({
            where: { userId },
            include: { allocations: true }
        });

        if (!staff) return;

        const tasks = await prisma.task.findMany({
            where: { assigneeId: userId, isDeleted: false },
            take: 100
        });

        const metrics = this.calculateMetrics(staff, tasks);

        await prisma.staff.update({
            where: { id: staff.id },
            data: {
                performanceScore: metrics.performanceScore,
                stressLevel: metrics.stressLevel,
                workload: tasks.filter(t => t.status === 'ASSIGNED' || t.status === 'IN_PROGRESS').length
            }
        });

        console.log(`📊 Updated Intelligence for ${staff.firstName}: Score=${metrics.performanceScore}, Stress=${metrics.stressLevel}`);
    }

    /**
     * 🔹 Core logic for score and stress calculation
     */
    static calculateMetrics(staff, tasks) {
        if (!tasks.length) return { performanceScore: 50, stressLevel: 0 };

        const completed = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'APPROVED');
        const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED' && t.status !== 'APPROVED');

        // 📈 Performance Calculation
        const completionRate = (completed.length / tasks.length) * 100;
        const avgFeedback = completed.reduce((sum, t) => sum + (t.feedbackScore || 0), 0) / (completed.length || 1);

        // base 40% completion rate + 40% feedback + 20% timeliness penalty
        const timelinessFactor = Math.max(0, 20 - (overdue.length * 5));
        const performanceScore = Number(((completionRate * 0.4) + (avgFeedback * 10 * 0.4) + timelinessFactor).toFixed(2));

        // 📉 Stress Level Calculation (0-10)
        // Factors: high workload, overdue tasks, low performance
        const workloadFactor = (tasks.filter(t => t.status !== 'COMPLETED').length / (staff.capacity || 5));
        const stressLevel = Number(Math.min(10, (workloadFactor * 5) + (overdue.length * 1.5) + (performanceScore < 40 ? 2 : 0)).toFixed(2));

        return {
            performanceScore: Math.min(100, Math.max(0, performanceScore)),
            stressLevel
        };
    }

    /**
     * 🔹 Predict attrition risk based on multi-week trends (Simplified for now)
     */
    static predictAttritionRisk(staff) {
        if (staff.stressLevel > 8 || staff.performanceScore < 30) {
            return "HIGH";
        }
        if (staff.stressLevel > 5 || staff.performanceScore < 60) {
            return "MEDIUM";
        }
        return "LOW";
    }
}
