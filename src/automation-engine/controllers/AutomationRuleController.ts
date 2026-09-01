import { prisma } from "../../app/prisma.js";
import type { Request, Response } from "express";
import { RuleEngine } from "../core/RuleEngine.js";

export class AutomationRuleController {
    /**
     * 📝 Create a new rule
     */
    static async createRule(req: Request, res: Response) {
        try {
            const { name, module, conditions, action, actionValue, priority, tenantId, unitId } = req.body;

            const rule = await prisma.automationRule.create({
                data: {
                    name,
                    module: module.toLowerCase(),
                    conditions,
                    action,
                    actionValue,
                    priority: Number(priority) || 0,
                    status: true,
                    tenantId: tenantId || "test-tenant",
                    unitId: unitId || "test-unit"
                }
            });

            res.status(201).json(rule);
        } catch (error) {
            console.error("❌ Error creating rule:", error);
            res.status(500).json({ error: "Failed to create automation rule" });
        }
    }

    /**
     * 📋 Get all rules for a module
     */
    static async getRules(req: Request, res: Response) {
        try {
            const { module, tenantId } = req.query;

            const rules = await prisma.automationRule.findMany({
                where: {
                    module: module ? (module as string).toLowerCase() : undefined,
                    tenantId: tenantId ? (tenantId as string) : undefined,
                },
                orderBy: { priority: "asc" }
            });

            res.json(rules);
        } catch (error) {
            console.error("❌ Error fetching rules:", error);
            res.status(500).json({ error: "Failed to fetch rules" });
        }
    }

    /**
     * 🔄 Update a rule
     */
    static async updateRule(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const updateData = req.body;

            const rule = await prisma.automationRule.update({
                where: { id: id as string },
                data: {
                    ...updateData,
                    priority: updateData.priority ? Number(updateData.priority) : undefined
                }
            });

            res.json(rule);
        } catch (error) {
            console.error("❌ Error updating rule:", error);
            res.status(500).json({ error: "Failed to update rule" });
        }
    }

    /**
     * 🗑️ Delete a rule
     */
    static async deleteRule(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.automationRule.delete({ where: { id: id as string } });
            res.status(204).send();
        } catch (error) {
            console.error("❌ Error deleting rule:", error);
            res.status(500).json({ error: "Failed to delete rule" });
        }
    }

    /**
     * 🧪 Test a rule logic against sample input
     */
    static async testRule(req: Request, res: Response) {
        try {
            const { conditions, input, module, event } = req.body;
            const isTriggered = RuleEngine.evaluate(conditions, { input, module, event });
            res.json({ triggered: isTriggered });
        } catch (error) {
            console.error("❌ Error testing rule:", error);
            res.status(500).json({ error: "Failed to test automation rule" });
        }
    }

    /**
     * 👯 Duplicate an existing rule
     */
    static async duplicateRule(req: Request, res: Response) {
        try {
            const id = req.params.id as string;
            const original = await prisma.automationRule.findUnique({ where: { id: id as string } });
            if (!original) return res.status(404).json({ error: "Rule not found" });

            const { id: _, createdAt: __, updatedAt: ___, ...rest } = original as any;
            const duplicated = await prisma.automationRule.create({
                data: {
                    ...rest,
                    name: `${original.name} (Copy)`,
                    status: false // Default to disabled for safety
                }
            });

            res.status(201).json(duplicated);
        } catch (error) {
            console.error("❌ Error duplicating rule:", error);
            res.status(500).json({ error: "Failed to duplicate rule" });
        }
    }
}
