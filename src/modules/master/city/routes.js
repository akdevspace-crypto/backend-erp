import { Router } from 'express';
import { handleCreateCity, handleGetCities, handleUpdateCity, handleDeleteCity } from './controller.js';
import { protect } from '../../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateCity);
router.get('/', handleGetCities);
router.put('/:id', handleUpdateCity);
router.delete('/:id', handleDeleteCity);

export default router;
