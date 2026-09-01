import { Router } from 'express';
import { handleCreateAllocation, handleGetHomeCareAllocations, handleGetClinicalCareAllocations, handleGetInHouseCareAllocations, handleGetOthersCareAllocations, handleUpdateAllocation } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/', handleCreateAllocation);
router.get('/home-care', handleGetHomeCareAllocations);
router.get('/clinical', handleGetClinicalCareAllocations);
router.get('/in-house', handleGetInHouseCareAllocations);
router.get('/others', handleGetOthersCareAllocations);
router.patch('/:id', handleUpdateAllocation);

export default router;
