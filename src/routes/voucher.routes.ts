import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { successResponse } from '../utils/response';
import { listApplicableVouchers } from '../utils/vouchers';

const router = Router();

// GET /api/vouchers?fare=66000&serviceType=CAR — vouchers usable for this trip.
router.get('/', authenticateToken, (req: Request, res: Response) => {
  const fare = Number(req.query.fare) || 0;
  const serviceType = req.query.serviceType === 'CAR' ? 'CAR' : 'RIDE';
  successResponse(res, 'Vouchers retrieved', listApplicableVouchers(fare, serviceType));
});

export default router;
