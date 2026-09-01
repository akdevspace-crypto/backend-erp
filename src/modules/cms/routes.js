import { Router } from 'express';
import multer from 'multer';
import { handleCreateBlog, handleGetBlogs, handleUpdateBlog, handleDeleteBlog } from './controller.js';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);
router.use(enforceTenant);

router.post('/blogs', upload.array('images', 5), handleCreateBlog);
router.get('/blogs', handleGetBlogs);
router.put('/blogs/:id', upload.array('images', 5), handleUpdateBlog);
router.delete('/blogs/:id', handleDeleteBlog);

export default router;
