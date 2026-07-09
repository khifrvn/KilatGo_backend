import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation.middleware';
import { registerCustomerSchema, registerDriverSchema, loginSchema, refreshSchema } from '../validators/auth.validator';
import { driverDocsUpload } from '../config/upload';

const router = Router();

router.post('/register/customer', validateBody(registerCustomerSchema), authController.registerCustomer);
router.post('/register/driver', driverDocsUpload, validateBody(registerDriverSchema), authController.registerDriver);
router.post('/login', validateBody(loginSchema), authController.login);
router.post('/refresh', validateBody(refreshSchema), authController.refresh);

export default router;
