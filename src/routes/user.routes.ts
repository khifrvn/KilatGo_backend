import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { updateProfileSchema, updateDriverProfileSchema, approveDriverSchema } from '../validators/user.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// Authenticated user routes
router.get('/profile', authenticateToken, userController.getProfile);
router.patch('/profile', authenticateToken, validateBody(updateProfileSchema), userController.updateProfile);
router.patch('/driver/profile', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(updateDriverProfileSchema), userController.updateDriverProfile);

// Admin routes
router.get('/', authenticateToken, authorizeRoles(UserRole.ADMIN), userController.listAllUsers);
router.get('/drivers', authenticateToken, authorizeRoles(UserRole.ADMIN), userController.listDrivers);
router.get('/customers', authenticateToken, authorizeRoles(UserRole.ADMIN), userController.listCustomers);
router.patch('/drivers/:id/approve', authenticateToken, authorizeRoles(UserRole.ADMIN), validateBody(approveDriverSchema), userController.approveDriver);

export default router;
