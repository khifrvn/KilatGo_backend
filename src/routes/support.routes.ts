import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { successResponse } from '../utils/response';
import * as supportService from '../services/support.service';

const router = Router();
router.use(authenticateToken); // customer / driver / merchant

// Daftar topik balas cepat.
router.get('/topics', (_req: Request, res: Response) => successResponse(res, 'Topik', supportService.listTopics()));

// Laporan saya.
router.get('/tickets', async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Laporan', await supportService.listMyTickets(req.user!.userId)); } catch (e) { next(e); }
});
router.post('/tickets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { subject, category } = req.body || {};
    successResponse(res, 'Laporan dibuat', await supportService.createTicket(req.user!.userId, req.user!.role, { subject, category }), 201);
  } catch (e) { next(e); }
});
router.get('/tickets/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Laporan', await supportService.getTicket(req.user!.userId, req.params.id)); } catch (e) { next(e); }
});
router.post('/tickets/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { body, category } = req.body || {};
    successResponse(res, 'Terkirim', await supportService.sendMessage(req.user!.userId, req.params.id, String(body ?? ''), category));
  } catch (e) { next(e); }
});
router.post('/tickets/:id/close', async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Laporan ditutup', await supportService.closeTicket(req.user!.userId, req.params.id)); } catch (e) { next(e); }
});
router.post('/tickets/:id/rate', async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Terima kasih', await supportService.rateTicket(req.user!.userId, req.params.id, Number(req.body?.stars), req.body?.comment)); } catch (e) { next(e); }
});

export default router;
