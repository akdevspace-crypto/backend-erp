import { prisma } from "../../app/prisma.js";

export class AutomationTaskController {
    static async listTasks(req: any, res: any) {
        try {
            const { tenantId, id: userId } = req.user;
            const unitId = req.query.unitId;

            if (!unitId) {
                return res.status(400).json({ success: false, message: "unitId is required" });
            }

            const tasks = await (prisma as any).automationTask.findMany({
                where: {
                    tenantId,
                    unitId,
                    assignedTo: userId,
                    status: "PENDING"
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({ success: true, data: tasks });
        } catch (error: any) {
            console.error("Error listing automation tasks:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    static async updateStatus(req: any, res: any) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const { tenantId } = req.user;

            const task = await (prisma as any).automationTask.update({
                where: { id, tenantId },
                data: {
                    status,
                    completedAt: status === 'COMPLETED' ? new Date() : undefined
                }
            });

            res.json({ success: true, data: task });
        } catch (error: any) {
            console.error("Error updating automation task:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
