import { Router } from 'express';
import {
    handleCreateInvoice,
    handleListInvoices,
    handleGetFinanceForecast,
    handleCreateIncome,
    handleCreateExpense,
    handleGetCashbox,
    handleRecordInvoicePayment,
    handleApproveTransaction,
    handleUpdateTransaction,
    handleDeleteTransaction
} from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();

router.use(protect);
router.use(enforceTenant);

router.post('/invoice/:id/payment', handleRecordInvoicePayment);
router.post('/invoice', handleCreateInvoice);
router.get('/invoice', handleListInvoices);
router.get('/finance/forecast', handleGetFinanceForecast);

router.post('/income', handleCreateIncome);
router.post('/expense', handleCreateExpense);
router.get('/cashbox', handleGetCashbox);
router.put('/:id/approve', handleApproveTransaction);
router.put('/finance/transactions/:id/approve', handleApproveTransaction);
router.put('/transactions/:id/approve', handleApproveTransaction);
router.put('/:id', handleUpdateTransaction);
router.delete('/:id', handleDeleteTransaction);

export default router;
