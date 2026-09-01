import { Router } from "express";
import { protect } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/rbac.middleware.js";
import { enforceTenant } from "../../shared/middleware/tenant.middleware.js";
import { handleAppendMessage, handleCreateConversation, handleGetConversation, handleListConversations } from "./controller.js";
import { InternalChatController } from "./internalController.js";

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post("/conversation", requirePermission("ENQUIRY", "CREATE"), handleCreateConversation);
router.get("/conversation", requirePermission("ENQUIRY", "READ"), handleListConversations);
router.get("/conversation/:id", requirePermission("ENQUIRY", "READ"), handleGetConversation);
router.post("/message/send", requirePermission("ENQUIRY", "CREATE"), handleAppendMessage);
router.post("/conversation/message", requirePermission("ENQUIRY", "CREATE"), handleAppendMessage);

// Internal Chat Routes
router.get("/internal/staff", InternalChatController.listStaff);
router.post("/internal/conversation", InternalChatController.getOrCreateConversation);
router.post("/internal/message", InternalChatController.sendMessage);

export default router;
