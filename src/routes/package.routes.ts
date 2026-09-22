import { Router } from 'express';
import * as packageController from '../controllers/driverPackage.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// Paket Mitra Driver (opsional): beli + lihat status. Hanya driver.
router.get('/info', authenticateToken, authorizeRoles(UserRole.DRIVER), packageController.info);
router.post('/orders', authenticateToken, authorizeRoles(UserRole.DRIVER), packageController.buy);
router.get('/orders', authenticateToken, authorizeRoles(UserRole.DRIVER), packageController.myOrders);
router.post('/orders/:id/repay', authenticateToken, authorizeRoles(UserRole.DRIVER), packageController.repay);

export default router;
