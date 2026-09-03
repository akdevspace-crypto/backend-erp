import { Router } from 'express';
import * as controller from './controller.js';
import * as outingController from './outing.controller.js';
import { auth } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(auth, enforceTenant);

router.post('/', controller.createVitalSign);
router.get('/:patientId', controller.getVitalsByPatient);

// Resident Outings
router.post('/outings', outingController.createOutingRequest);
router.get('/outings', outingController.listOutingRequests);
router.get('/outings/:id', outingController.getOutingRequest);
router.post('/outings/:id/approve', outingController.processOutingApproval);

export default router;
