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

// Fase 2: merchant approval
router.get('/merchants/pending', adminController.getPendingMerchants);
router.get('/merchants/:id', adminController.getMerchant);
router.post('/merchants/:id/approve', adminController.approveMerchant);

// Fase 3: absen & KYC
router.get('/attendance', adminController.getAttendance);
router.post('/kyc/:subjectType/:subjectId/verify', adminController.verifyKyc);

// Pengaturan (komisi/tarif) & kendala
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.get('/complaints', adminController.getComplaints);
router.patch('/complaints/:id', adminController.updateComplaint);

// Log error
router.get('/errors', adminController.getErrors);
router.delete('/errors', adminController.clearErrors);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);

export default router;
