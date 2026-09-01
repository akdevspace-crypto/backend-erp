import { Router } from 'express';
import multer from 'multer';
import { protect, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import {
    handleComplaintAnalysis,
    handleCreateComplaint,
    handleGetComplaints,
    handleGetPendingFeedback,
    handleGetServiceHistory,
    handleCreateRenewalFollowUp,
    handleRecordServiceFeedback,
    handleUpdateComplaintWorkflow
} from './controller.js';

const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage });

const router = Router();

router.use(protect);
router.use(enforceTenant);

// Canonical frontend paths
router.post('/complaints', upload.single('complaintAttachment'), handleCreateComplaint);
router.get('/complaints', handleGetComplaints);
router.patch('/complaints/:complaintId/workflow', handleUpdateComplaintWorkflow);
router.get('/complaints/analysis', handleComplaintAnalysis);
router.get('/service-history', handleGetServiceHistory);
router.get('/pending-feedback', handleGetPendingFeedback);
router.post('/renewals/:allocationId/follow-up', handleCreateRenewalFollowUp);
router.post('/service-history/:allocationId/feedback', handleRecordServiceFeedback);

// Backward-compatible aliases
router.post('/complaint', upload.single('complaintAttachment'), handleCreateComplaint);
router.get('/complaint', handleGetComplaints);
router.get('/complaint/analysis', handleComplaintAnalysis);

export default router;
