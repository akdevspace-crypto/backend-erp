import { Router } from 'express';
import { chatWithCopilot } from './copilot.controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// 🤖 Copilot Chat: Authenticated access required
router.post('/chat', protect, chatWithCopilot);

export default router;
