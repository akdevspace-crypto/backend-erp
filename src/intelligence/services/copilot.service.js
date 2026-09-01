import { prisma } from "../../app/prisma.js";
import { DashboardService } from "./dashboard.service.js";
import { RevenueForecastService } from "./revenue-forecast.service.js";
import { AiService } from "./ai.service.js";

export class CopilotService {
    /**
     * 🔹 TOOL: Fetch execution trace for a lead
     */
    static async getLeadTrace({ entityId, tenantId, unitId }) {
        return prisma.automationLog.findFirst({
            where: { tenantId, unitId, module: "enquiry", entityId },
            orderBy: { createdAt: "desc" }
        });
    }

    /**
     * 🔹 TOOL: Fetch revenue statistics and forecasts
     */
    static async getRevenueStats({ tenantId, unitId }) {
        const latestForecast = await RevenueForecastService.getLatestForecast(tenantId, unitId);
        const recentTransactions = await prisma.accountTransaction.findMany({
            where: { tenantId, unitId, isDeleted: false },
            orderBy: { date: "desc" },
            take: 30
        });
        return { latestForecast, recentTransactions };
    }

    /**
     * 🔹 TOOL: Fetch pending follow-ups
     */
    static async getFollowUps({ tenantId, unitId }) {
        return prisma.followUp.findMany({
            where: { tenantId, unitId, outcome: { not: "COMPLETED" }, isDeleted: false },
            include: { enquiry: { include: { client: true } } },
            orderBy: { scheduledAt: "asc" },
            take: 20
        });
    }

    /**
     * 🔹 TOOL: Fetch account anomalies
     */
    static async getAnomalies({ tenantId, unitId }) {
        return prisma.automationLog.findMany({
            where: { tenantId, unitId, module: "accounts", label: "ANOMALY" },
            orderBy: { createdAt: "desc" },
            take: 15
        });
    }

    /**
     * 🔹 TOOL: Fetch overdue follow-up tasks (Task Escalation)
     */
    static async getOverdueTasks({ tenantId, unitId }) {
        const now = new Date();
        return prisma.followUp.findMany({
            where: {
                tenantId,
                unitId,
                status: { not: "COMPLETED" },
                nextDate: { lt: now },
                isDeleted: false
            },
            include: { enquiry: { include: { client: true } } },
            orderBy: { nextDate: "asc" },
            take: 10
        });
    }

    /**
     * 🔹 TOOL: Fetch staff performance insights
     */
    static async getStaffKPIs({ tenantId, unitId }) {
        return prisma.staff.findMany({
            where: { tenantId, unitId, isDeleted: false },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                performanceScore: true,
                currentWorkload: true,
                capacity: true
            },
            orderBy: { performanceScore: "desc" },
            take: 10
        });
    }

    /**
     * 🔹 MAIN ENTRY: Answer user query via LLM
     */
    static async answerQuery(query, user) {
        const { tenantId, unitId } = user;

        const tools = [
            {
                name: "getLeadTrace",
                description: "Explains why a lead or enquiry has a specific score or label by fetching its automation trace.",
                parameters: {
                    type: "object",
                    properties: { entityId: { type: "string", description: "The UUID of the enquiry or lead" } },
                    required: ["entityId"]
                },
                handler: (args) => this.getLeadTrace({ ...args, tenantId, unitId })
            },
            {
                name: "getRevenueStats",
                description: "Fetches recent revenue transactions and the latest revenue forecast.",
                parameters: { type: "object", properties: {} },
                handler: () => this.getRevenueStats({ tenantId, unitId })
            },
            {
                name: "getFollowUps",
                description: "Retrieves a list of pending customer follow-ups that need attention.",
                parameters: { type: "object", properties: {} },
                handler: () => this.getFollowUps({ tenantId, unitId })
            },
            {
                name: "getAnomalies",
                description: "Lists recent financial or operational anomalies detected by the system.",
                parameters: { type: "object", properties: {} },
                handler: () => this.getAnomalies({ tenantId, unitId })
            },
            {
                name: "getOverdueTasks",
                description: "Identifies pending tasks or follow-ups that have missed their scheduled deadlines.",
                parameters: { type: "object", properties: {} },
                handler: () => this.getOverdueTasks({ tenantId, unitId })
            },
            {
                name: "getStaffKPIs",
                description: "Fetches performance scores and current workloads for staff members.",
                parameters: { type: "object", properties: {} },
                handler: () => this.getStaffKPIs({ tenantId, unitId })
            }
        ];

        const context = {
            additional: `Current User: ${user.firstName}. Tenant: ${tenantId}. Unit: ${unitId}.`
        };

        return AiService.chatWithTools(query, tools, context);
    }
}
