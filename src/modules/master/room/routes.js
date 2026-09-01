import { Router } from 'express';
import { handleCreateRoom, handleGetRooms, handleUpdateRoom, handleDeleteRoom } from './controller.js';

const router = Router();

router.post('/', handleCreateRoom);
router.get('/', handleGetRooms);
router.put('/:id', handleUpdateRoom);
router.delete('/:id', handleDeleteRoom);

export default router;
