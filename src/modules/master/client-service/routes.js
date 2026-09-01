import { Router } from 'express';
import { handleCreateClientService, handleGetClientServices, handleUpdateClientService, handleDeleteClientService } from './controller.js';

const router = Router();

router.post('/', handleCreateClientService);
router.get('/', handleGetClientServices);
router.put('/:id', handleUpdateClientService);
router.delete('/:id', handleDeleteClientService);

export default router;
