import { Router } from "express";
import { ExotelController } from "./controller.js";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/rbac.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";

const router = Router();

router.post("/exotel/incoming-call", ExotelController.incomingCall);
router.post("/exotel/call-status", ExotelController.callStatus);
router.post("/webhook/exotel/call", ExotelController.exotelCallWebhook);

router.post(
    "/exotel/call/outbound",
    protect,
    enforceTenant,
    requirePermission("ENQUIRY", "CREATE"),
    ExotelController.outboundCall
);

router.get(
    "/exotel/call/analytics",
    protect,
    enforceTenant,
    ExotelController.callAnalytics
);

router.get(
    "/exotel/call/history",
    protect,
    enforceTenant,
    ExotelController.callHistory
);

router.get(
    "/calls/history",
    protect,
    enforceTenant,
    ExotelController.callHistory
);

router.get(
    "/calls/sync",
    protect,
    enforceTenant,
    ExotelController.callSync
);

router.get(
    "/calls/history/global",
    protect,
    enforceTenant,
    ExotelController.globalCallHistory
);

router.get(
    "/calls/analytics/global",
    protect,
    enforceTenant,
    ExotelController.globalCallAnalytics
);

router.get(
    "/calls/sync/global",
    protect,
    enforceTenant,
    ExotelController.globalCallSync
);

router.get(
    "/exotel/call/context",
    protect,
    enforceTenant,
    ExotelController.callContext
);

export default router;
