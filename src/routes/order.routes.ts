import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  verifyPickupSchema,
  rateOrderSchema,
} from '../validators/order.validator';
import { orderProofUpload, orderCompleteUpload } from '../config/upload';
import { UserRole } from '@prisma/client';

const router = Router();

// Customer routes
router.post('/', authenticateToken, authorizeRoles(UserRole.CUSTOMER), validateBody(createOrderSchema), orderController.createOrder);
router.get('/', authenticateToken, orderController.listOrders);

// Daftar chat customer↔driver (kedua peran; static path — harus sebelum /:id).
router.get('/conversations', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), orderController.listConversations);

// Driver routes — static paths MUST come before /:id or they match as an id.
router.get('/available', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.findAvailableOrders);
router.get('/offer', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.getMyOffer);
router.get('/active', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.getActiveOrder);
router.get('/customer-active', authenticateToken, authorizeRoles(UserRole.CUSTOMER), orderController.getCustomerActiveOrder);
router.post('/:id/decline', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.declineOffer);

router.get('/:id', authenticateToken, orderController.getOrder);
// Boost pencarian driver (pelanggan/mitra) — validasi kepemilikan di service.
router.get('/:id/boost', authenticateToken, orderController.getBoostInfo);
router.post('/:id/boost', authenticateToken, orderController.boostOrder);
// Foto profil driver order (stream file privat; hanya pihak order).
router.get('/:id/driver-photo', authenticateToken, orderController.getDriverPhoto);
router.patch('/:id/cancel', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), validateBody(cancelOrderSchema), orderController.cancelOrder);
router.post('/:id/accept', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.assignDriver);
router.patch('/:id/status', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(updateOrderStatusSchema), orderController.updateStatus);
// FOOD: driver verifikasi kode pickup di resto, lalu selesai antar dgn bukti foto.
router.post('/:id/verify-pickup', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(verifyPickupSchema), orderController.verifyPickup);
router.post('/:id/complete', authenticateToken, authorizeRoles(UserRole.DRIVER), orderCompleteUpload, orderController.completeOrder);
// SEND: kurir foto barang saat jemput.
router.post('/:id/pickup-photo', authenticateToken, authorizeRoles(UserRole.DRIVER), orderProofUpload, orderController.pickupPhoto);
// Rating dua arah (customer & driver) setelah selesai.
router.post('/:id/rate', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), validateBody(rateOrderSchema), orderController.rateOrder);
// Chat customer↔driver per order.
router.get('/:id/messages', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), orderController.listMessages);
router.post('/:id/messages', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), orderController.sendMessage);

export default router;
