import { Router } from 'express';
import { handleCreateTask, handleGetTasks, handleUpdateTaskStatus } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateTask);
router.get('/', handleGetTasks);
router.patch('/:id/status', handleUpdateTaskStatus);

export default router;
