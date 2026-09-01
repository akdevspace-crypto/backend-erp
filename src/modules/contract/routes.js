import { Router } from 'express';
import {
    handleGetContract,
    handleCreateContract,
    handleUpdateContract,
    handleActivateContract
} from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { requirePermission } from '../../shared/middleware/rbac.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/admission/:admissionId', requirePermission('ADMISSION', 'READ'), handleGetContract);
router.post('/', requirePermission('ADMISSION', 'UPDATE'), handleCreateContract);
router.patch('/:id', requirePermission('ADMISSION', 'UPDATE'), handleUpdateContract);
router.post('/:id/activate', requirePermission('CONTRACT', 'UPDATE'), handleActivateContract);

export default router;
