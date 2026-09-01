import { prisma } from "../../app/prisma.js";

export class AutoActionEngine {
    /**
     * 🔹 Trigger business actions based on automation score
     */
    static async triggerActions(
        tenantId: string,
        unitId: string,
        module: string,
        entityId: string,
        score: number,
        assignedTo?: string
    ) {
        console.log(`🤖 AutoActionEngine: Evaluating actions for ${entityId} (Score: ${score})`);

        try {
            // 🎯 Action 1: Create Immediate Task for HOT Leads
            if (score >= 70) {
                await prisma.automationTask.create({
                    data: {
                        tenantId,
                        unitId,
                        module,
                        entityId,
                        taskType: "IMMEDIATE_CALL",
                        description: "🚨 HOT LEAD: High priority inquiry detected! Perform emergency call within 15 mins.",
                        status: "PENDING",
                        assignedTo
                    }
                });
                console.log("⚡ Auto-Action: Task 'IMMEDIATE_CALL' created.");
            }

            // 🎯 Action 2: Schedule Follow-up for WARM Leads
            else if (score >= 40) {
                await prisma.automationTask.create({
                    data: {
                        tenantId,
                        unitId,
                        module,
                        entityId,
                        taskType: "SCHEDULE_FOLLOWUP",
                        description: "📅 SCHEDULE: Warm lead requiring engagement. Schedule a follow-up for tomorrow.",
                        status: "PENDING",
                        assignedTo
                    }
                });
                console.log("⚡ Auto-Action: Task 'SCHEDULE_FOLLOWUP' created.");
            }

        } catch (error) {
            console.error("❌ AutoActionEngine Error:", error);
            throw error;
        }
    }
}
