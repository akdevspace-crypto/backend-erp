import { Router } from 'express';
import * as controller from './controller.js';
import { auth } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(auth, enforceTenant);

router.post('/', controller.createWelcomeCall);
router.get('/', controller.getWelcomeCalls);
router.put('/:id', controller.updateWelcomeCall);

export default router;
