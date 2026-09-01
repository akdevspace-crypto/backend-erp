import { Router } from 'express';
import { handleGetProfile } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/me', handleGetProfile);

export default router;
