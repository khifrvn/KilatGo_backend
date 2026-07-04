import { Router } from 'express';
import * as orderController from '../controllers/order.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
} from '../validators/order.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// Customer routes
router.post('/', authenticateToken, authorizeRoles(UserRole.CUSTOMER), validateBody(createOrderSchema), orderController.createOrder);
router.get('/', authenticateToken, orderController.listOrders);
router.get('/:id', authenticateToken, orderController.getOrder);
router.patch('/:id/cancel', authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER), validateBody(cancelOrderSchema), orderController.cancelOrder);

// Driver routes
router.get('/available', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.findAvailableOrders);
router.post('/:id/accept', authenticateToken, authorizeRoles(UserRole.DRIVER), orderController.assignDriver);
router.patch('/:id/status', authenticateToken, authorizeRoles(UserRole.DRIVER), validateBody(updateOrderStatusSchema), orderController.updateStatus);

export default router;
