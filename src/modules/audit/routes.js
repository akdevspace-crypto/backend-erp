import { Router } from 'express';
import { protect, authorizeRoles } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { getAuditLogs } from './controller.js';

const router = Router();

// Only Super Admins and Managers should have access to the Audit logs
const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'UNIT_MANAGER'];

// Apply middleware
router.use(protect);
router.use(enforceTenant);

// Routes
router.get('/logs', authorizeRoles(...allowedRoles), getAuditLogs);

export default router;
