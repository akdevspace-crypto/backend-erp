import { prisma } from '../../app/prisma.js';

export class ActionExecutor {
    static async execute(
        actionType: string,
        actionConfig: any,
        context: any,
        tenantId: string,
        unitId: string
    ) {
        switch (actionType) {
            case 'create_task':
                await this.createTask(actionConfig, context, tenantId, unitId);
                break;
            case 'send_notification':
                await this.sendNotification(actionConfig, context, tenantId, unitId);
                break;
            case 'db_update':
                await this.updateDatabase(actionConfig, context, tenantId, unitId);
                break;
            default:
                console.warn(`Unknown action type: ${actionType}`);
        }
    }

    private static async createTask(config: any, context: any, tenantId: string, unitId: string) {
        // Replace templates in description, eg "Follow up with {{name}}"
        let desc = config.description || 'Auto-generated task';
        for (const key of Object.keys(context)) {
            if (context[key] !== undefined && context[key] !== null) {
                desc = desc.replace(new RegExp(`{{${key}}}`, 'g'), String(context[key]));
            }
        }

        try {
            if (!tenantId || !unitId) {
                console.warn("⚠️ Skipping DB write: missing context");
                return;
            }

            await prisma.automationTask.create({
                data: {
                    tenantId,
                    unitId,
                    module: config.module || context.module || 'GENERIC',
                    entityId: context.entityId,
                    taskType: config.taskType || 'AUTO',
                    description: desc,
                    assignedTo: config.assignedTo || null,
                    status: 'ASSIGNED'
                }
            });
        } catch (err) {
            console.error("⚠️ DB write failed (automationTask):", err);
        }
    }

    private static async sendNotification(config: any, context: any, tenantId: string, unitId: string) {
        // console logging for now since we don't have a distinct notification model requirement definition beyond 'notify agent'
        console.log(`[Automation Notification] To: ${config.to}, Msg: ${config.message}`);
    }

    private static async updateDatabase(config: any, context: any, tenantId: string, unitId: string) {
        // Implementation for dynamic DB update based on config.
        // e.g. update status of an enquiry or account transaction.
        // As it requires highly coupled code, we will emit an event or console log for future AI extensions.
        console.log(`[Automation DBUpdate] target: ${config.target}, payload:`, config.updateData);
    }
}
