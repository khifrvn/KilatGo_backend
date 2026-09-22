import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { successResponse } from '../utils/response';
import * as voucherService from '../services/voucher.service';

const router = Router();

// GET /api/vouchers?serviceType=FOOD&fare=15000&itemsTotal=40000 — voucher yang bisa dipakai user ini.
router.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const serviceType = String(req.query.serviceType || 'RIDE').toUpperCase();
    const fare = Number(req.query.fare) || 0;
    const itemsTotal = Number(req.query.itemsTotal) || 0;
    const list = await voucherService.listApplicable(req.user!.userId, serviceType, fare, itemsTotal);
    successResponse(res, 'Vouchers retrieved', list);
  } catch (e) { next(e); }
});

export default router;
