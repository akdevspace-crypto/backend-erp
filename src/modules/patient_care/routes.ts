import { Router } from 'express';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { requireRoles } from '../../shared/middleware/rbac.middleware.js';
import {
    getAdlRecords,
    createAdlRecord,
    updateAdlStatus,
    getNutritionPlans,
    createNutritionPlan,
    getClinicalSummary
} from './controller.js';


const router = Router();

router.use(auth);
router.use(enforceTenant);

router.get('/ping', (req, res) => {
    res.json({ message: "Patient Care module is active" });
});

// ADL Records
router.get('/adl-records', getAdlRecords);
router.post('/adl-records', createAdlRecord);
router.patch('/adl-records/:id/status', updateAdlStatus);

// Nutrition
router.get('/nutrition', getNutritionPlans);
router.post('/nutrition', createNutritionPlan);

// Incident Reports are currently owned by UEC (/api/v1/uec/incidents). We will leave them there until full ownership transfer is analyzed.

// Shared Clinical Summary
router.get('/residents/:id/clinical-summary', getClinicalSummary);

export default router;
