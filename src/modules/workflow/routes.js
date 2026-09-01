import { Router } from 'express';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { handleListWorkflowTimelines } from './controller.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/timeline', handleListWorkflowTimelines);

export default router;
