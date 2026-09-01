import { Router, Request, Response, NextFunction } from 'express';
import { auth, enforceTenant } from '../../shared/middleware/auth.middleware.js';
import { listNotifications, markNotificationRead } from './service.js';

const router = Router();

router.get('/', auth, enforceTenant, async (req: any, res: Response, next: NextFunction) => {
    try {
        const notifications = await listNotifications(req.user);
        res.json({ success: true, data: notifications });
    } catch (error) {
        next(error);
    }
});

router.patch('/:id/read', auth, enforceTenant, async (req: any, res: Response, next: NextFunction) => {
    try {
        const notification = await markNotificationRead(req.user, req.params.id);
        res.json({ success: true, data: notification, message: 'Notification marked as read' });
    } catch (error) {
        next(error);
    }
});

export default router;
