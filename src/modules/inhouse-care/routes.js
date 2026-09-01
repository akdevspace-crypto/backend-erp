import { Router } from 'express';
import * as controller from './controller.js';
import { auth } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(auth, enforceTenant);

router.post('/', controller.createVitalSign);
router.get('/:patientId', controller.getVitalsByPatient);

export default router;
