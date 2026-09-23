import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation.middleware';
import { registerCustomerSchema, registerDriverSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';
import { forgotPasswordLimiter, resetPasswordLimiter } from '../middleware/rateLimit.middleware';
import { driverDocsUpload } from '../config/upload';

const router = Router();

router.post('/register/customer', validateBody(registerCustomerSchema), authController.registerCustomer);
router.post('/register/driver', driverDocsUpload, validateBody(registerDriverSchema), authController.registerDriver);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);

// Lupa sandi: minta tautan via email, lalu pakai token dari tautan itu.
router.post('/password/forgot', forgotPasswordLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/password/reset', resetPasswordLimiter, validateBody(resetPasswordSchema), authController.resetPassword);

export default router;
