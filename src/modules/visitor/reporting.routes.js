import { Router } from 'express';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { getFacilityVisits, createFacilityVisit } from './reporting.controller.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/', getFacilityVisits);
router.post('/', createFacilityVisit);

export default router;
