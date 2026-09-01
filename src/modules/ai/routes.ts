import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";
import { handleAllocation, handleNlp, handleScoring } from "./controller.js";

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post("/scoring", handleScoring);
router.post("/nlp", handleNlp);
router.post("/allocation", handleAllocation);

export default router;
