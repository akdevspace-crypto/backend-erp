import { Router } from 'express';
import { protect, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import {
    handleCreateClientPortalComplaint,
    handleGetClientPortalComplaints,
    handleGetClientPortalMedicines,
    handleGetClientPortalServices,
    handleGetClientPortalSummary,
    handleRecordClientPortalFeedback,
    handleGetClientPortalVitals,
    handleGetClientPortalADL,
    handleGetClientPortalNutrition
} from './controller.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.get('/summary', handleGetClientPortalSummary);
router.get('/services', handleGetClientPortalServices);
router.get('/medicines', handleGetClientPortalMedicines);
router.get('/complaints', handleGetClientPortalComplaints);
router.post('/complaints', handleCreateClientPortalComplaint);
router.post('/services/:allocationId/feedback', handleRecordClientPortalFeedback);

router.get('/vitals', handleGetClientPortalVitals);
router.get('/adl', handleGetClientPortalADL);
router.get('/nutrition', handleGetClientPortalNutrition);

export default router;
