import { Router } from 'express';
import * as promoController from '../controllers/promo.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Promo aktif untuk role pemanggil (customer/driver/mitra).
router.get('/', authenticateToken, promoController.listMine);

export default router;
