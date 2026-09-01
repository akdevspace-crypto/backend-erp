import { Router } from 'express';
import { protect } from '../../shared/middleware/auth.middleware.js';
import { enforceTenant } from '../../shared/middleware/tenant.middleware.js';
import { handleCreateUser, handleDeleteUser, handleListUsers, handleUpdateUser } from './controller.js';

const router = Router();

const requireSuperAdmin = (req, _res, next) => {
    const roleName = String(req.user?.role?.name || req.user?.role || '').trim().toLowerCase();
    const hasAllAccess = Array.isArray(req.user?.permissions) && req.user.permissions.includes('ALL_ACCESS');

    if (hasAllAccess || roleName === 'super admin' || roleName === 'superadmin' || roleName === 'admin') {
        return next();
    }

    const error = new Error('Super admin access required');
    error.status = 403;
    return next(error);
};

router.use(protect);
router.use(enforceTenant);
router.use(requireSuperAdmin);

router.get('/users', handleListUsers);
router.post('/users', handleCreateUser);
router.put('/users/:id', handleUpdateUser);
router.delete('/users/:id', handleDeleteUser);

export default router;
