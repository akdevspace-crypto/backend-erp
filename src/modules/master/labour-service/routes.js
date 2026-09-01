import { Router } from 'express';
import { handleCreateLabourService, handleGetLabourServices, handleUpdateLabourService, handleDeleteLabourService } from './controller.js';

const router = Router();

router.post('/', handleCreateLabourService);
router.get('/', handleGetLabourServices);
router.put('/:id', handleUpdateLabourService);
router.delete('/:id', handleDeleteLabourService);

export default router;
