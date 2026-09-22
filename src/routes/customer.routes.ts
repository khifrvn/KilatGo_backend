import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';
import * as topupService from '../services/topup.service';
import * as customerWalletService from '../services/customerWallet.service';
import { driverDocsUpload } from '../config/upload';
import { successResponse } from '../utils/response';

const router = Router();
const customerOnly = [authenticateToken, authorizeRoles(UserRole.CUSTOMER)];

// Saldo KilatGo customer.
router.get('/balance', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Saldo', await topupService.getCustomerBalance(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

// Buat top-up saldo → dapat URL pembayaran iPaymu. Kredit otomatis via webhook saat sukses.
router.post('/topup', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const amount = Number(req.body.amount);
    successResponse(res, 'Top up dibuat', await topupService.createCustomerTopUp(req.user!.userId, amount));
  } catch (e) {
    next(e);
  }
});

// Riwayat saldo (top-up masuk; siap untuk transaksi keluar nanti).
router.get('/topups', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Riwayat saldo', await topupService.listCustomerTopUps(req.user!.userId));
  } catch (e) {
    next(e);
  }
});

router.get('/topup/:referenceId', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Status', await topupService.getCustomerTopUpStatus(req.user!.userId, req.params.referenceId));
  } catch (e) {
    next(e);
  }
});

// Batalkan top up yang masih PENDING (tidak jadi bayar).
router.post('/topup/:referenceId/cancel', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Top up dibatalkan', await topupService.cancelCustomerTopUp(req.user!.userId, req.params.referenceId));
  } catch (e) {
    next(e);
  }
});

// ===== KYC + tarik saldo pelanggan =====
// Status dompet (saldo, KYC, kelengkapan) untuk gating fitur tarik.
router.get('/wallet/status', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Status dompet', await customerWalletService.getWalletStatus(req.user!.userId)); } catch (e) { next(e); }
});
// Kirim KYC (KTP + selfie KTP). Multipart: field ktpPhoto & selfiePhoto (reuse driverDocsUpload).
router.post('/kyc', ...customerOnly, driverDocsUpload, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = (req.files as Record<string, Express.Multer.File[]>) || {};
    successResponse(res, 'KYC dikirim', await customerWalletService.submitKyc(req.user!.userId, {
      ktpPhoto: files.ktpPhoto?.[0]?.filename,
      selfiePhoto: files.selfiePhoto?.[0]?.filename,
    }));
  } catch (e) { next(e); }
});
// Simpan rekening tujuan penarikan.
router.patch('/wallet/bank', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Rekening disimpan', await customerWalletService.updateBank(req.user!.userId, req.body || {})); } catch (e) { next(e); }
});
// Buat / ganti PIN penarikan.
router.post('/wallet/pin', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'PIN disimpan', await customerWalletService.setPin(req.user!.userId, String(req.body?.pin ?? ''), req.body?.oldPin)); } catch (e) { next(e); }
});
// Lupa PIN → reset dengan sandi akun.
router.post('/wallet/pin/reset', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'PIN direset', await customerWalletService.resetPin(req.user!.userId, String(req.body?.password ?? ''), String(req.body?.newPin ?? ''))); } catch (e) { next(e); }
});
// Ajukan penarikan.
router.post('/wallet/withdraw', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Pengajuan penarikan dibuat', await customerWalletService.createWithdrawal(req.user!.userId, Number(req.body?.amount), String(req.body?.pin ?? '')));
  } catch (e) { next(e); }
});
// Riwayat penarikan.
router.get('/wallet/withdrawals', ...customerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Riwayat penarikan', await customerWalletService.listWithdrawals(req.user!.userId)); } catch (e) { next(e); }
});

export default router;
