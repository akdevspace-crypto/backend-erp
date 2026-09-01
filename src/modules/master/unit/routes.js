import { Router } from 'express';
import { handleCreateUnit, handleGetUnits, handleUpdateUnit, handleDeleteUnit, handleGetAuthorizedUnits } from './controller.js';
import { protect } from '../../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateUnit);
router.get('/authorized', handleGetAuthorizedUnits);
router.get('/', handleGetUnits);
router.put('/:id', handleUpdateUnit);
router.delete('/:id', handleDeleteUnit);

export default router;
