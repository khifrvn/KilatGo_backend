import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import * as topupService from '../services/topup.service';
import * as withdrawalService from '../services/withdrawal.service';
import * as packageService from '../services/driverPackage.service';
import * as manualOrderService from '../services/manualOrder.service';
import { successResponse } from '../utils/response';

const router = Router();

const driverOnly = [authenticateToken, authorizeRoles(UserRole.DRIVER)];

// Buat/ganti PIN penarikan
router.patch('/pin', ...driverOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await withdrawalService.setPin(req.user!.userId, String(req.body?.pin ?? ''), req.body?.oldPin);
    successResponse(res, 'PIN disimpan', data);
  } catch (e) {
    next(e);
  }
});

// Lupa PIN → reset dengan sandi akun (user tentukan PIN baru sendiri).
router.post('/pin/reset', ...driverOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await withdrawalService.resetPin(req.user!.userId, String(req.body?.password ?? ''), String(req.body?.newPin ?? ''));
    successResponse(res, 'PIN direset', data);
  } catch (e) {
    next(e);
  }
});

// Ajukan penarikan
router.post('/withdraw', ...driverOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await withdrawalService.createWithdrawal(
      req.user!.userId,
      Number(req.body?.amount),
      String(req.body?.pin ?? '')
    );
    successResponse(res, 'Pengajuan penarikan dibuat', data, 201);
  } catch (e) {
    next(e);
  }
});

// Riwayat penarikan
router.get('/withdrawals', ...driverOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await withdrawalService.listWithdrawals(req.user!.userId);
    successResponse(res, 'Riwayat penarikan', data);
  } catch (e) {
    next(e);
  }
});

// Driver: buat top up (dapat URL pembayaran iPaymu)
router.post(
  '/topup',
  authenticateToken,
  authorizeRoles(UserRole.DRIVER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const amount = Number(req.body?.amount);
      const data = await topupService.createTopUp(req.user!.userId, amount);
      successResponse(res, 'Top up dibuat', data, 201);
    } catch (e) {
      next(e);
    }
  }
);

// Driver: cek status top up (polling)
router.get(
  '/topup/:referenceId',
  authenticateToken,
  authorizeRoles(UserRole.DRIVER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await topupService.getTopUpStatus(req.user!.userId, req.params.referenceId);
      successResponse(res, 'Status top up', data);
    } catch (e) {
      next(e);
    }
  }
);

// Webhook iPaymu (publik, tanpa auth). iPaymu kirim form-encoded.
router.post('/topup/callback', async (req: Request, res: Response) => {
  try {
    await topupService.handleCallback(req.body || {});
  } catch (e) {
    console.error('topup callback error', e);
  }
  res.status(200).json({ ok: true }); // selalu 200 supaya iPaymu tidak retry berlebihan
});

// Callback pembayaran Paket Mitra Driver (referenceId berprefiks PKG-).
router.post('/package/callback', async (req: Request, res: Response) => {
  try {
    await packageService.handleCallback(req.body || {});
  } catch (e) {
    console.error('package callback error', e);
  }
  res.status(200).json({ ok: true });
});

// Callback pembayaran link Order Manual (referenceId berprefiks MORDER-).
router.post('/manual-order/callback', async (req: Request, res: Response) => {
  try {
    await manualOrderService.handleCallback(req.body || {});
  } catch (e) {
    console.error('manual-order callback error', e);
  }
  res.status(200).json({ ok: true });
});

export default router;
