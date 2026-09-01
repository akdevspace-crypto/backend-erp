import { Router } from 'express';
import { handleCreateWelcomeCall, handleGetWelcomeCalls, handleUpdateWelcomeCall } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateWelcomeCall);
router.get('/', handleGetWelcomeCalls);
router.patch('/:id', handleUpdateWelcomeCall);

export default router;
