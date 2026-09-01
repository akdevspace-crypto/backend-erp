import { Router } from 'express';
import * as closureController from './controller.js';
import { requirePermission } from '../../shared/middleware/rbac.middleware.js';
import { protect, enforceTenant } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// Apply authentication middleware globally for closure routes
router.use(protect);

// Closure uses ADMISSION_UPDATE permission scope as per RBAC audit
router.get('/', requirePermission('ADMISSION', 'READ'), enforceTenant, closureController.getClosures);
router.post('/admission/:admissionId', requirePermission('ADMISSION', 'UPDATE'), enforceTenant, closureController.startOrFetchClosure);
router.get('/admission/:admissionId', requirePermission('ADMISSION', 'READ'), closureController.startOrFetchClosure); // Same logic fits for GET
router.patch('/:id/clearance', requirePermission('ADMISSION', 'UPDATE'), enforceTenant, closureController.clearRequirement);
router.post('/:id/execute', requirePermission('ADMISSION', 'UPDATE'), enforceTenant, closureController.executeClosure);

export default router;
