import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken, notificationController.listNotifications);
router.patch('/:id/read', authenticateToken, notificationController.markAsRead);
router.patch('/read-all', authenticateToken, notificationController.markAllAsRead);

export default router;
