import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";
import { handleAnalyticsForecast, handleGetKPIs, handleGetOrganizationDashboard } from "./controller.js";

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get("/kpis", handleGetKPIs);
router.get("/organization/:orgCode", handleGetOrganizationDashboard);
router.get("/forecast", handleAnalyticsForecast);
router.post("/forecast", handleAnalyticsForecast);

export default router;
