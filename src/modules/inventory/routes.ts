import { Router } from 'express';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import * as controller from './controller.js';

const router = Router();

// POST /api/v1/product
router.post('/product', auth, enforceTenant, controller.createProduct);

// GET /api/v1/product
router.get('/product', auth, enforceTenant, controller.getProducts);

// GET /api/v1/stock
router.get('/stock', auth, enforceTenant, controller.getStock);

// GET /api/v1/stock/batches
router.get('/stock/batches', auth, enforceTenant, controller.getBatches);

// GET /api/v1/purchase
router.get('/purchase', auth, enforceTenant, controller.getPurchases);

// GET /api/v1/stock/issue-requests
router.get('/stock/issue-requests', auth, enforceTenant, controller.getIssueRequests);

// POST /api/v1/stock/issue-requests
router.post('/stock/issue-requests', auth, enforceTenant, controller.createIssueRequest);

// POST /api/v1/stock/issue-requests/:id/approve
router.post('/stock/issue-requests/:id/approve', auth, enforceTenant, controller.approveIssueRequest);

// POST /api/v1/stock/issue-requests/:id/reject
router.post('/stock/issue-requests/:id/reject', auth, enforceTenant, controller.rejectIssueRequest);

// GET /api/v1/stock/movements
router.get('/stock/movements', auth, enforceTenant, controller.getStockMovements);

// POST /api/v1/stock/update
router.post('/stock/update', auth, enforceTenant, controller.updateStock);

// POST /api/v1/purchase
router.post('/purchase', auth, enforceTenant, controller.createPurchase);

// POST /api/v1/stock/kitchen-requisition
router.post('/stock/kitchen-requisition', auth, enforceTenant, controller.createKitchenRequisition);

export default router;
