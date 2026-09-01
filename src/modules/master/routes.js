import { Router } from 'express';
import cityRoutes from './city/routes.js';
import unitRoutes from './unit/routes.js';
import clientServiceRoutes from './client-service/routes.js';
import departmentRoutes from './department/routes.js';
import labourServiceRoutes from './labour-service/routes.js';
import paymentCategoryRoutes from './payment-category/routes.js';
import vendorRoutes from './vendor/routes.js';
import roomRoutes from './room/routes.js';

import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';

const router = Router();

// Apply authentication and tenant isolation to all master routes
router.use(auth);
router.use(enforceTenant);

router.use('/city', cityRoutes);
router.use('/unit', unitRoutes);
router.use('/client-service', clientServiceRoutes);
router.use('/department', departmentRoutes);
router.use('/labour-service', labourServiceRoutes);
router.use('/payment-category', paymentCategoryRoutes);
router.use('/vendor', vendorRoutes);
router.use('/room', roomRoutes);

export default router;
