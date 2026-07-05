import { Router, Request, Response, NextFunction } from 'express';
import { getPublicSettings } from '../services/settings.service';
import { successResponse } from '../utils/response';

const router = Router();

// Publik: info kontak untuk landing page.
router.get('/public', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Public settings', await getPublicSettings());
  } catch (e) {
    next(e);
  }
});

export default router;
