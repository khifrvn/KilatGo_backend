import { Router } from 'express';
import * as trackingController from '../controllers/tracking.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { driverLocationSchema } from '../validators/tracking.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// Driver routes
router.post('/location', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(driverLocationSchema), trackingController.updateLocation);
router.get('/location', authenticateToken, authorizeRoles(UserRole.DRIVER), trackingController.getMyLocation);
router.post('/online', authenticateToken, authorizeRoles(UserRole.DRIVER), trackingController.setOnline);
router.post('/offline', authenticateToken, authorizeRoles(UserRole.DRIVER), trackingController.setOffline);

// Customer / shared routes
router.get('/orders/:orderId', authenticateToken, trackingController.getOrderTracking);

export default router;
