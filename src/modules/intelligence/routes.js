import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/rbac.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";
import {
    handleBuildForecast,
    handleCopilotQuery,
    handleCreateCampaign,
    handleCreateTemplate,
    handleDashboard,
    handleGetForecast,
    handleLaunchCampaign,
    handleListTemplates,
    handleSendOutbound
} from "./controller.js";

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get("/dashboard", requirePermission("INTELLIGENCE", "READ"), handleDashboard);
router.post("/copilot/query", requirePermission("INTELLIGENCE", "READ"), handleCopilotQuery);
router.post("/forecast/build", requirePermission("INTELLIGENCE", "ADMIN"), handleBuildForecast);
router.get("/forecast/latest", requirePermission("INTELLIGENCE", "READ"), handleGetForecast);
router.post("/templates", requirePermission("ENQUIRY", "CREATE"), handleCreateTemplate);
router.get("/templates", requirePermission("ENQUIRY", "READ"), handleListTemplates);
router.post("/outbound/send", requirePermission("ENQUIRY", "CREATE"), handleSendOutbound);
router.post("/campaigns", requirePermission("ENQUIRY", "CREATE"), handleCreateCampaign);
router.post("/campaigns/:id/launch", requirePermission("ENQUIRY", "CREATE"), handleLaunchCampaign);

export default router;
