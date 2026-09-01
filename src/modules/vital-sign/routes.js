import { Router } from 'express';
import { handleCreateVitalSign, handleGetVitalSigns, handleUpdateVitalSign } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateVitalSign);
router.get('/', handleGetVitalSigns);
router.patch('/:id', handleUpdateVitalSign);

export default router;
