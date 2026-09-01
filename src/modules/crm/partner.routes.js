import { Router } from 'express';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { getPartners, createPartner } from './partner.controller.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/', getPartners);
router.post('/', createPartner);

export default router;
