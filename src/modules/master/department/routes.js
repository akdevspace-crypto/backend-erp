import { Router } from 'express';
import { handleCreateDepartment, handleGetDepartments, handleUpdateDepartment, handleDeleteDepartment } from './controller.js';

const router = Router();

router.post('/', handleCreateDepartment);
router.get('/', handleGetDepartments);
router.put('/:id', handleUpdateDepartment);
router.delete('/:id', handleDeleteDepartment);

export default router;
