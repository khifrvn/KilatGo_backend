import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { successResponse, errorResponse } from '../utils/response';
import * as complaintService from '../services/complaint.service';

const router = Router();

// Driver / mitra kirim kendala
router.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, message, category } = req.body || {};
    if (!subject || !message) {
      errorResponse(res, 'subject & message wajib', 400);
      return;
    }
    const c = await complaintService.createComplaint(req.user!.userId, req.user!.role, { subject, message, category });
    successResponse(res, 'Kendala terkirim', c, 201);
  } catch (e) {
    next(e);
  }
});

export default router;
