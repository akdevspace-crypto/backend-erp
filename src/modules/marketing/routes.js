import { Router } from 'express';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { getCampaigns, createCampaign } from './controller.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);

export default router;
