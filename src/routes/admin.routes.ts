import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require admin role
router.use(authenticateToken, authorizeRoles(UserRole.ADMIN));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/orders', adminController.getAllOrders);
router.get('/earnings', adminController.getEarningsReport);
router.get('/drivers/pending', adminController.getPendingDrivers);
router.get('/files/:name', adminController.getDriverDocument);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);

export default router;
