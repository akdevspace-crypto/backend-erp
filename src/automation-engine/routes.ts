import { Router } from "express";
import { prisma } from "../app/prisma.js";
import { AutomationRuleController } from "./controllers/AutomationRuleController.js";
import { OmniController } from "./controllers/OmniController.js";
import { AutomationTraceController } from "./controllers/AutomationTraceController.js";
import { AutomationTaskController } from "./controllers/AutomationTaskController.js";
import { protect } from "../shared/middleware/auth.middleware.js";
import { enforceTenant } from "../shared/middleware/tenant.middleware.js";
import { ScoringEngine } from "../intelligence/services/scoring.engine.js";

const router = Router();

router.post("/webhook/whatsapp", OmniController.whatsappWebhook);
router.post("/webhook/email", OmniController.emailWebhook);

router.use(protect);
router.use(enforceTenant);

router.get("/score/:entityId", async (req: any, res: any) => {
    try {
        const module = String(req.query.module || "enquiry");
        const score = await (prisma as any).automationScore.findFirst({
            where: {
                tenantId: req.user.tenantId,
                unitId: req.user.unitId,
                entityId: req.params.entityId,
                module
            },
            orderBy: { updatedAt: "desc" }
        });

        if (!score) {
            return res.status(404).json({ success: false, message: "Automation score not found" });
        }

        return res.json({ success: true, data: score });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/recalculate", async (req: any, res: any) => {
    try {
        const entityId = req.body?.entityId;
        const module = String(req.body?.module || "enquiry");

        if (!entityId) {
            return res.status(400).json({ success: false, message: "entityId is required" });
        }

        const score = await ScoringEngine.calculateScore(entityId, module, {
            tenantId: req.user.tenantId,
            unitId: req.user.unitId
        });

        return res.json({ success: true, data: score, message: "Automation score recalculated" });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

router.get("/trace/:entityId", AutomationTraceController.getTrace);
router.get("/tasks", AutomationTaskController.listTasks);
router.patch("/tasks/:id/status", AutomationTaskController.updateStatus);
router.post("/", AutomationRuleController.createRule);
router.get("/", AutomationRuleController.getRules);
router.post("/test", AutomationRuleController.testRule);
router.post("/:id/duplicate", AutomationRuleController.duplicateRule);
router.put("/:id", AutomationRuleController.updateRule);
router.delete("/:id", AutomationRuleController.deleteRule);

export default router;
