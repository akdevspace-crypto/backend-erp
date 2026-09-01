import { Router } from 'express';
import { handleCreateEnquiry, handleListEnquiries, handleGetEnquiry, handleUpdateEnquiry, handleDeleteEnquiry, handleAddFollowUp, handleListAdmissions, handleConvertEnquiryToAdmission, handleRenewalFollowUpOutcome, handleCreateAdmissionClientPortalAccess, handleCreateExistingPatientAdmission, handleUpsertEnquiryClientPortalAccess } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { requirePermission } from '../../shared/middleware/rbac.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

// Apply global middlewares
router.use(protect);
router.use(enforceTenant);

router.post('/', requirePermission('ENQUIRY', 'CREATE'), handleCreateEnquiry);
router.get('/', requirePermission('ENQUIRY', 'READ'), handleListEnquiries);
router.get('/admissions', requirePermission('ENQUIRY', 'READ'), handleListAdmissions);
router.post('/admissions/existing-patient', requirePermission('ENQUIRY', 'CREATE'), handleCreateExistingPatientAdmission);
router.post('/admissions/:admissionId/client-portal-access', requirePermission('ENQUIRY', 'UPDATE'), handleCreateAdmissionClientPortalAccess);
router.post('/:id/convert-to-admission', requirePermission('ENQUIRY', 'UPDATE'), handleConvertEnquiryToAdmission);
router.post('/:id/renewal-outcome', requirePermission('ENQUIRY', 'UPDATE'), handleRenewalFollowUpOutcome);
router.post('/:id/client-portal-access', requirePermission('ENQUIRY', 'UPDATE'), handleUpsertEnquiryClientPortalAccess);
router.get('/:id', requirePermission('ENQUIRY', 'READ'), handleGetEnquiry);
router.put('/:id', requirePermission('ENQUIRY', 'UPDATE'), handleUpdateEnquiry);
router.delete('/:id', requirePermission('ENQUIRY', 'DELETE'), handleDeleteEnquiry);
router.post('/:id/follow-up', requirePermission('ENQUIRY', 'CREATE'), handleAddFollowUp);

export default router;
