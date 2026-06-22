import { Router } from 'express';
import { authenticate } from '@shared/middlewares/authenticate';
import { notificationController } from '@features/notification/controllers/notification.controller';

const router = Router();

router.get('/notifications', authenticate, notificationController.list);
router.get('/notifications/unread-count', authenticate, notificationController.unreadCount);
router.post('/notifications/read-all', authenticate, notificationController.markAllRead);
router.post('/notifications/:id/read', authenticate, notificationController.markRead);

export default router;
