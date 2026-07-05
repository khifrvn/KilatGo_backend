import { Router } from 'express';
import * as merchantController from '../controllers/merchant.controller';
import { validateBody } from '../middleware/validation.middleware';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { registerMerchantSchema, addMenuSchema } from '../validators/merchant.validator';
import { merchantDocsUpload, singlePhotoUpload } from '../config/upload';
import { UserRole } from '@prisma/client';

const router = Router();

// Publik: pendaftaran mitra usaha (GoFood)
router.post('/register', merchantDocsUpload, validateBody(registerMerchantSchema), merchantController.register);

// Merchant login-required
router.get('/me', authenticateToken, authorizeRoles(UserRole.MERCHANT), merchantController.getMe);
router.post('/menus', authenticateToken, authorizeRoles(UserRole.MERCHANT), singlePhotoUpload, validateBody(addMenuSchema), merchantController.addMenu);

export default router;
