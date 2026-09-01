import { Router } from 'express';
import { handleCreateVendor, handleGetVendors, handleUpdateVendor, handleDeleteVendor } from './controller.js';

const router = Router();

router.post('/', handleCreateVendor);
router.get('/', handleGetVendors);
router.put('/:id', handleUpdateVendor);
router.delete('/:id', handleDeleteVendor);

export default router;
