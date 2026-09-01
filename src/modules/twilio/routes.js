import { Router } from "express";
import { TwilioController } from "./controller.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/rbac.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";

const router = Router();

router.post("/twilio/incoming-sms", TwilioController.incomingSMS);
router.post("/webhook/twilio/call", TwilioController.callWebhook);

router.post(
    "/twilio/sms/outbound",
    protect,
    enforceTenant,
    requirePermission("ENQUIRY", "CREATE"),
    TwilioController.outboundSMS
);

export default router;
