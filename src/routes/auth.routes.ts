import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { validateBody } from '../middleware/validation.middleware';
import { registerCustomerSchema, registerDriverSchema, loginSchema } from '../validators/auth.validator';

const router = Router();

router.post('/register/customer', validateBody(registerCustomerSchema), authController.registerCustomer);
router.post('/register/driver', validateBody(registerDriverSchema), authController.registerDriver);
router.post('/login', validateBody(loginSchema), authController.login);

export default router;
