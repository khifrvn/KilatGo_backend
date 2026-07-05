import { Router, Request, Response } from 'express';
import { logError } from '../services/errorlog.service';
import { successResponse } from '../utils/response';

const router = Router();

// Report error dari sisi client (frontend). Publik + best-effort.
router.post('/', (req: Request, res: Response) => {
  const { message, path, stack } = req.body || {};
  if (message) {
    logError({ level: 'CLIENT', message: String(message), path: path ? String(path) : undefined, stack: stack ? String(stack) : undefined });
  }
  successResponse(res, 'logged', { ok: true });
});

export default router;
