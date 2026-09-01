import { prisma } from '../../app/prisma.js';
import { AiService } from '../../intelligence/services/ai.service.js';

/**
 * 🤖 CopilotService: The intelligence engine behind the Conversational ERP
 */
export class CopilotService {
    /**
     * Main entry point for chatting with the Copilot
     */
    static async chat(query, tenantId, unitId, userId) {
        console.log(`💬 Copilot Query [${tenantId}]:`, query);

        // 1️⃣ Define Tools (Function Declarations)
        const tools = [
            {
                name: "get_kpi_summary",
                description: "Get a summary of key performance indicators like total leads, conversion rates, and hot leads.",
                parameters: {
                    type: "object",
                    properties: {},
                },
                handler: async () => await this.getKPISummary(tenantId, unitId)
            },
            {
                name: "get_lead_details",
                description: "Get detailed information about a specific lead (enquiry), including its AI score and status.",
                parameters: {
                    type: "object",
                    properties: {
                        enquiryId: { type: "string", description: "The ID of the lead/enquiry" },
                        refNo: { type: "string", description: "The Reference Number (e.g., ENQ-12345)" }
                    },
                },
                handler: async (args) => await this.getLeadDetails(tenantId, unitId, args)
            },
            {
                name: "get_recent_activity",
                description: "Get a list of recent automation events and scores processed by the system.",
                parameters: {
                    type: "object",
                    properties: {
                        limit: { type: "number", description: "Number of events to fetch (default 10)" }
                    },
                },
                handler: async (args) => await this.getRecentActivity(tenantId, unitId, args)
            }
        ];

        // 2️⃣ Execute Chat with Tools
        const result = await AiService.chatWithTools(query, tools, {
            additional: `Tenant: ${tenantId}, Unit: ${unitId}. User ID: ${userId}. Focus on providing helpful, data-driven ERP insights.`
        });

        return result;
    }

    /**
     * TOOL: KPI Summary
     */
    static async getKPISummary(tenantId, unitId) {
        try {
            const totalLeads = await prisma.enquiry.count({ where: { tenantId, unitId, isDeleted: false } });
            const convertedLeads = await prisma.enquiry.count({ where: { tenantId, unitId, isConverted: true } });
            const hotLeads = await prisma.automationScore.count({ where: { tenantId, unitId, label: 'HOT' } });

            const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

            return {
                totalLeads,
                convertedLeads,
                hotLeads,
                conversionRate: `${conversionRate}%`,
                status: "Success"
            };
        } catch (error) {
            console.error("❌ Copilot Tool Error (KPI):", error);
            return { error: "Failed to fetch KPI summary" };
        }
    }

    /**
     * TOOL: Lead Details
     */
    static async getLeadDetails(tenantId, unitId, { enquiryId, refNo }) {
        try {
            const where = { tenantId, unitId, isDeleted: false };
            if (enquiryId) where.id = enquiryId;
            else if (refNo) where.refNo = refNo;
            else return { error: "Please provide an enquiryId or refNo" };

            const enquiry = await prisma.enquiry.findFirst({
                where,
                include: {
                    client: true,
                    scores: {
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (!enquiry) return { error: "Lead not found" };

            return {
                id: enquiry.id,
                refNo: enquiry.refNo,
                status: enquiry.status,
                client: enquiry.client?.name,
                isConverted: enquiry.isConverted,
                latestScore: enquiry.scores?.[0]?.score || "N/A",
                label: enquiry.scores?.[0]?.label || "N/A",
                createdAt: enquiry.createdAt
            };
        } catch (error) {
            console.error("❌ Copilot Tool Error (Lead):", error);
            return { error: "Failed to fetch lead details" };
        }
    }

    /**
     * TOOL: Recent Activity
     */
    static async getRecentActivity(tenantId, unitId, { limit = 10 }) {
        try {
            const logs = await prisma.automationLog.findMany({
                where: { tenantId, unitId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    module: true,
                    event: true,
                    score: true,
                    label: true,
                    createdAt: true
                }
            });

            return logs.map(l => ({
                action: `${l.module}.${l.event}`,
                result: `${l.label} (${l.score || 0})`,
                at: l.createdAt
            }));
        } catch (error) {
            console.error("❌ Copilot Tool Error (Activity):", error);
            return { error: "Failed to fetch recent activity" };
        }
    }
}
