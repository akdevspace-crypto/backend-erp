import { Router } from "express";
import { WebhookController } from "./controller.js";
import { ExotelController } from "../exotel/controller.js";
import { TwilioController } from "../twilio/controller.js";

const router = Router();

router.get("/whatsapp", WebhookController.verifyWhatsApp);
router.post("/whatsapp", WebhookController.whatsapp);
router.post("/email", WebhookController.email);
router.post("/exotel/call-status", ExotelController.exotelCallWebhook);
router.post("/twilio/call-status", TwilioController.callWebhook);

export default router;
