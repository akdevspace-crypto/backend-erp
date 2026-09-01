import { prisma } from '../../app/prisma.js';
import { ActionExecutor } from '../actions/ActionExecutor.js';
import { RuleEngine } from './RuleEngine.js';

export class WorkflowEngine {
    static async executeWorkflows(
        tenantId: string,
        unitId: string,
        module: string,
        event: string,
        decisionContext: any
    ) {
        // Find workflows matching the module and event
        const workflows = await prisma.automationWorkflow.findMany({
            where: {
                tenantId,
                unitId,
                module,
                triggerEvent: event,
                status: true
            }
        });

        for (const wf of workflows) {
            // Re-using the robust RuleEngine parsing to parse the Workflow structured JSON conditions!
            const conditionMet = RuleEngine.evaluate(wf.conditions as any, decisionContext);
            if (conditionMet) {
                decisionContext.actions.push(wf.actionType);
                await ActionExecutor.execute(
                    wf.actionType,
                    wf.actionConfig, // Passed as Json
                    decisionContext,
                    tenantId,
                    unitId
                );
            }
        }
    }
}
