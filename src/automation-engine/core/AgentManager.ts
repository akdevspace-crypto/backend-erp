import type { DecisionContext } from "./DecisionLogic.js";
import { WorkflowEngine } from "./WorkflowEngine.js";
import { FollowUpEngine } from "./FollowUpEngine.js";
import { AllocationEngine } from "./AllocationEngine.js";

export class AgentManager {
    /**
     * 🧠 Central Dispatcher for Multi-Agent Systems
     */
    static async handleDecision(ctx: DecisionContext) {
        console.log(`🤖 AgentManager: Dispatching agents for ${ctx.module}...`);

        switch (ctx.module) {
            case "enquiry":
                await this.leadAgent(ctx);
                break;
            case "accounts":
                await this.financeAgent(ctx);
                break;
            case "hr":
                await this.hrAgent(ctx);
                break;
            default:
                console.log(`ℹ️ No specialized agent for module: ${ctx.module}`);
        }

        // Record agent actions back to the log
        // This would usually trigger side-effects like sending notifications
        await this.postAgentReview(ctx);
    }

    private static async postAgentReview(ctx: DecisionContext) {
        const { module, meta } = ctx;
        console.log(`✅ ${module} Label: ${ctx.computed.label}`);
        // Optionally persist agent reasoning
    }

    /**
     * 🎯 Lead Agent: Focuses on lead conversion and follow-ups
     */
    private static async leadAgent(ctx: DecisionContext) {
        const { entityId, meta, computed } = ctx;

        if (computed.label === "HOT") {
            console.log("🔥 LeadAgent: High-intent lead! Escalating & Scheduling Optimized Follow-up.");
            ctx.actions.push({ type: "ESCALATE_SALES", payload: { priority: "IMMEDIATE" } });

            // Auto-schedule optimized engagement
            await FollowUpEngine.scheduleFollowUp(entityId, meta.tenantId, meta.unitId, computed.score);
        } else if (computed.label === "WARM") {
            console.log("🟠 LeadAgent: Warm lead. Scheduling engagement window.");
            await FollowUpEngine.scheduleFollowUp(entityId, meta.tenantId, meta.unitId, computed.score);
        }

        // 🔹 Evolution: Auto-Allocation for ALL leads
        const serviceType = (ctx.input as any).serviceType || "General";
        await AllocationEngine.assignBestStaff(entityId, meta.tenantId, meta.unitId, serviceType);
    }

    /**
     * 💰 Finance Agent: Focuses on fraud and anomalies
     */
    private static async financeAgent(ctx: DecisionContext) {
        if (ctx.computed.label === "ANOMALY") {
            console.log("⚠️ FinanceAgent: Fraud detected! Locking transaction.");
            ctx.actions.push({ type: "LOCK_TRANSACTION", payload: { reason: "Anomaly Detected" } });
        }
    }

    /**
     * 👥 HR Agent: Focuses on attrition and employee well-being
     */
    private static async hrAgent(ctx: DecisionContext) {
        if (ctx.computed.label === "CRITICAL_RISK") {
            console.log("👥 HRAgent: High attrition risk! Alerting Department Head.");
            ctx.actions.push({ type: "ATTRITION_ALERT", payload: { dept: ctx.input.department } });
        }
    }
}
