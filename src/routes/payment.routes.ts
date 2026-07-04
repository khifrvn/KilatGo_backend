import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { processPaymentSchema } from '../validators/payment.validator';
import { UserRole } from '@prisma/client';

const router = Router();

router.post('/process', authenticateToken, authorizeRoles(UserRole.CUSTOMER), validateBody(processPaymentSchema), paymentController.processPayment);
router.get('/', authenticateToken, paymentController.listPayments);
router.get('/orders/:orderId', authenticateToken, paymentController.getPaymentByOrder);
router.get('/:id', authenticateToken, paymentController.getPayment);

export default router;
