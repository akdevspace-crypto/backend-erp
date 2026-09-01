import { Router } from 'express';
import { handleCreatePaymentCategory, handleGetPaymentCategorys, handleUpdatePaymentCategory, handleDeletePaymentCategory } from './controller.js';

const router = Router();

router.post('/', handleCreatePaymentCategory);
router.get('/', handleGetPaymentCategorys);
router.put('/:id', handleUpdatePaymentCategory);
router.delete('/:id', handleDeletePaymentCategory);

export default router;
