import { Router } from 'express';
import * as merchantController from '../controllers/merchant.controller';
import { validateBody } from '../middleware/validation.middleware';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { registerMerchantSchema, addMenuSchema, updateMenuSchema, categorySchema, merchantOrderActionSchema, updateMerchantMeSchema, updateProfileSchema, withdrawSchema } from '../validators/merchant.validator';
import { merchantDocsUpload, menuPhotoUpload, logoUpload } from '../config/upload';
import { UserRole } from '@prisma/client';

const router = Router();

// Publik: pendaftaran mitra usaha (GoFood)
router.post('/register', merchantDocsUpload, validateBody(registerMerchantSchema), merchantController.register);

// Merchant login-required
router.get('/me', authenticateToken, authorizeRoles(UserRole.MERCHANT), merchantController.getMe);
router.patch('/me', authenticateToken, authorizeRoles(UserRole.MERCHANT), validateBody(updateMerchantMeSchema), merchantController.updateMe);
router.patch('/profile', authenticateToken, authorizeRoles(UserRole.MERCHANT), logoUpload, validateBody(updateProfileSchema), merchantController.updateProfile);
router.post('/menus', authenticateToken, authorizeRoles(UserRole.MERCHANT), menuPhotoUpload, validateBody(addMenuSchema), merchantController.addMenu);
router.patch('/menus/:id', authenticateToken, authorizeRoles(UserRole.MERCHANT), menuPhotoUpload, validateBody(updateMenuSchema), merchantController.updateMenu);
router.delete('/menus/:id', authenticateToken, authorizeRoles(UserRole.MERCHANT), merchantController.deleteMenu);

// Kategori (CRUD)
const merchantAuth = [authenticateToken, authorizeRoles(UserRole.MERCHANT)];
router.get('/categories', ...merchantAuth, merchantController.listCategories);
router.post('/categories', ...merchantAuth, validateBody(categorySchema), merchantController.addCategory);
router.patch('/categories/:id', ...merchantAuth, validateBody(categorySchema), merchantController.renameCategory);
router.delete('/categories/:id', ...merchantAuth, merchantController.deleteCategory);

// Order masuk ke merchant (KilatFood)
router.get('/orders', ...merchantAuth, merchantController.listOrders);
router.get('/orders/:id', ...merchantAuth, merchantController.getOrder);
router.patch('/orders/:id/status', ...merchantAuth, validateBody(merchantOrderActionSchema), merchantController.updateOrderStatus);
router.patch('/me/fcm-token', ...merchantAuth, merchantController.setFcmToken);

router.get('/me/report', ...merchantAuth, merchantController.getReport);

// Saldo & penarikan (Payment Link)
router.get('/wallet', ...merchantAuth, merchantController.getWallet);
router.post('/withdrawals', ...merchantAuth, validateBody(withdrawSchema), merchantController.createWithdrawal);
// PIN penarikan mitra: status, buat/ganti, reset (lupa PIN via sandi akun).
router.get('/withdraw-pin', ...merchantAuth, merchantController.getWithdrawPinStatus);
router.post('/withdraw-pin', ...merchantAuth, merchantController.setWithdrawPin);
router.post('/withdraw-pin/reset', ...merchantAuth, merchantController.resetWithdrawPin);

// Promosi berbayar mitra + isi saldo mitra (untuk membeli paket promosi).
router.get('/promo', ...merchantAuth, merchantController.getPromo);
router.post('/promo', ...merchantAuth, merchantController.buyPromo);
router.post('/topup', ...merchantAuth, merchantController.createTopUp);
router.get('/topup/:referenceId', ...merchantAuth, merchantController.getTopUpStatus);

// Publik: customer browse warung + menu. authenticateToken saja (semua role).
// HARUS paling bawah — '/:id' menangkap sisa GET satu-segmen.
router.get('/', authenticateToken, merchantController.listPublic);
router.get('/:id', authenticateToken, merchantController.getPublic);

export default router;
