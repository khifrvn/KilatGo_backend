import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { updateProfileSchema, updateDriverProfileSchema, approveDriverSchema } from '../validators/user.validator';
import { avatarUpload } from '../config/upload';
import { UserRole } from '@prisma/client';

const router = Router();

// Authenticated user routes
router.get('/profile', authenticateToken, userController.getProfile);
router.patch('/profile', authenticateToken, validateBody(updateProfileSchema), userController.updateProfile);
router.post('/profile/avatar', authenticateToken, avatarUpload, userController.uploadAvatar);
router.patch('/fcm-token', authenticateToken, userController.updateUserFcmToken);
router.patch('/driver/profile', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(updateDriverProfileSchema), userController.updateDriverProfile);
router.get('/driver/selfie', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getMyDriverPhoto);
router.get('/driver/reviews', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getDriverReviews);
router.get('/driver/stats', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getDriverStats);
router.get('/driver/earnings', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getDriverEarnings);
router.get('/driver/wallet', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getDriverWallet);
router.patch('/driver/fcm-token', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.updateFcmToken);
router.get('/driver/services', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.getDriverServices);
router.patch('/driver/services', authenticateToken, authorizeRoles(UserRole.DRIVER), userController.updateDriverServices);

// Admin routes (RBAC per-menu; listAllUsers dipakai halaman Pelanggan & modal Isi Saldo)
router.get('/', authenticateToken, authorizeRoles(UserRole.ADMIN), requirePermission('customers', 'drivers', 'topups'), userController.listAllUsers);
router.get('/drivers', authenticateToken, authorizeRoles(UserRole.ADMIN), requirePermission('drivers'), userController.listDrivers);
router.get('/customers', authenticateToken, authorizeRoles(UserRole.ADMIN), requirePermission('customers'), userController.listCustomers);
router.patch('/drivers/:id/approve', authenticateToken, authorizeRoles(UserRole.ADMIN), requirePermission('approval', 'drivers'), validateBody(approveDriverSchema), userController.approveDriver);

export default router;
