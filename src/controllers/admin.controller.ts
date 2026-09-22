import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { KycSubject } from '@prisma/client';
import * as adminService from '../services/admin.service';
import * as merchantService from '../services/merchant.service';
import * as attendanceService from '../services/attendance.service';
import * as kycService from '../services/kyc.service';
import * as settingsService from '../services/settings.service';
import * as errorLogService from '../services/errorlog.service';
import * as notificationService from '../services/notification.service';
import * as supportService from '../services/support.service';
import { successResponse, errorResponse } from '../utils/response';
import { UPLOAD_DIR } from '../config/upload';

// ===== Log error =====
export async function getErrors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Error logs', await errorLogService.listErrors({ level: req.query.level as string | undefined })); } catch (e) { next(e); }
}
export async function clearErrors(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Error logs cleared', await errorLogService.clearErrors()); } catch (e) { next(e); }
}

// ===== Pengaturan =====
export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Settings', await settingsService.getSettings()); } catch (e) { next(e); }
}
export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Settings updated', await settingsService.updateSettings(req.body || {})); } catch (e) { next(e); }
}

// Unggah musik latar layar perbaikan → simpan URL-nya langsung ke settings.
export async function uploadMaintenanceMusic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) { errorResponse(res, 'File musik wajib diunggah', 400); return; }
    const proto = (req.get('x-forwarded-proto') || req.protocol).split(',')[0];
    const url = `${proto}://${req.get('host')}/uploads/music/${file.filename}`;
    await settingsService.updateSettings({ maintenance_music_url: url });
    successResponse(res, 'Musik diunggah', { url });
  } catch (e) { next(e); }
}

// ===== Penarikan saldo driver =====
export async function getWithdrawals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Withdrawals', await adminService.listWithdrawals(req.query.status as string | undefined)); } catch (e) { next(e); }
}
export async function approveWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Withdrawal approved', await adminService.approveWithdrawal(req.params.id, req.body?.referenceNumber)); } catch (e) { next(e); }
}
export async function rejectWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Withdrawal rejected', await adminService.rejectWithdrawal(req.params.id, String(req.body?.reason ?? ''))); } catch (e) { next(e); }
}

// ===== Fase 2: Merchant approval =====
export async function getMerchants(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Merchants', await merchantService.listMerchants()); } catch (e) { next(e); }
}
export async function getPendingMerchants(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Pending merchants', await merchantService.listPendingMerchants());
  } catch (e) { next(e); }
}
export async function getMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Merchant detail', await merchantService.getMerchant(req.params.id));
  } catch (e) { next(e); }
}
export async function setMenuAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const isAvailable = req.body?.isAvailable !== false;
    successResponse(res, 'Menu updated', await merchantService.adminSetMenuAvailability(req.params.id, isAvailable));
  } catch (e) { next(e); }
}
export async function getMerchantReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Merchant report', await merchantService.getReport(req.params.id));
  } catch (e) { next(e); }
}
export async function approveMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const approve = req.body?.isApproved !== false;
    successResponse(res, approve ? 'Merchant approved' : 'Merchant rejected', await merchantService.approveMerchant(req.params.id, approve));
  } catch (e) { next(e); }
}

// ===== Fase 3: Absen & KYC =====
export async function getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Log absen', await attendanceService.listAllAttendance({ date: req.query.date as string | undefined }));
  } catch (e) { next(e); }
}
export async function deleteAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Absen dihapus', await attendanceService.deleteAttendance(req.params.id)); } catch (e) { next(e); }
}
export async function verifyKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const t = String(req.params.subjectType).toUpperCase();
    const subjectType = t === 'MERCHANT' ? KycSubject.MERCHANT : t === 'CUSTOMER' ? KycSubject.CUSTOMER : KycSubject.DRIVER;
    const record = await kycService.verify(subjectType, req.params.subjectId, { approve: req.body?.approve !== false, ...req.body });
    successResponse(res, 'KYC updated', record);
  } catch (e) { next(e); }
}

// Daftar pelanggan yang mengajukan KYC (PENDING/VERIFIED/REJECTED) untuk halaman Persetujuan.
export async function getCustomerKycList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'KYC pelanggan', await adminService.listCustomerKyc(req.query.status as string | undefined)); } catch (e) { next(e); }
}
// Hapus/reset KYC pelanggan → wajib verifikasi ulang.
export async function resetCustomerKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'KYC direset', await adminService.resetCustomerKyc(req.params.id)); } catch (e) { next(e); }
}

// Serve dokumen KYC privat (admin-only via admin.routes). Token boleh via ?token= untuk <img>.
export function getDriverDocument(req: Request, res: Response): void {
  const name = path.basename(req.params.name); // cegah path traversal
  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    errorResponse(res, 'File not found', 404);
    return;
  }
  res.sendFile(filePath);
}

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    successResponse(res, 'Dashboard stats retrieved', stats);
  } catch (error) {
    next(error);
  }
}

export async function getPendingCounts(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    successResponse(res, 'Pending counts', await adminService.getPendingCounts());
  } catch (error) {
    next(error);
  }
}

// Rating & ulasan (isi komentar) — target: DRIVER | MERCHANT | CUSTOMER.
export async function getRatings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await adminService.listRatings({
      target: req.query.target ? String(req.query.target).toUpperCase() : undefined,
      subjectId: req.query.subjectId ? String(req.query.subjectId) : undefined,
      stars: req.query.stars ? Number(req.query.stars) : undefined,
      withComment: req.query.withComment === '1' || req.query.withComment === 'true',
      q: req.query.q ? String(req.query.q) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    successResponse(res, 'Ratings', data);
  } catch (e) { next(e); }
}

export async function getAllOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await adminService.getAllOrders({
      status: req.query.status as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    successResponse(res, 'Orders retrieved', orders.data, 200, orders.meta);
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.body;
    const order = await adminService.updateOrderStatus(req.params.id, status);
    successResponse(res, 'Order status updated', order);
  } catch (error) {
    next(error);
  }
}

export async function getEarningsReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const report = await adminService.getEarningsReport({
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      groupBy: req.query.groupBy as any,
    });
    successResponse(res, 'Earnings report retrieved', report);
  } catch (error) {
    next(error);
  }
}

export async function getPendingDrivers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const drivers = await adminService.getPendingDrivers();
    successResponse(res, 'Pending drivers retrieved', drivers);
  } catch (error) {
    next(error);
  }
}

export async function suspendUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await adminService.suspendUser(req.params.id, req.body?.reason);
    successResponse(res, 'User suspended', user);
  } catch (error) {
    next(error);
  }
}

export async function activateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await adminService.activateUser(req.params.id);
    successResponse(res, 'User activated', user);
  } catch (error) {
    next(error);
  }
}

// ===== Akses semua akun (bantuan helpdesk) =====
export async function getUserAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Akun', await adminService.getUserAccount(req.params.id)); } catch (e) { next(e); }
}
export async function updateUserAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Akun diperbarui', await adminService.updateUserAccount(req.params.id, req.body || {})); } catch (e) { next(e); }
}
export async function adjustUserBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { amount, wallet, note, pin } = req.body || {};
    successResponse(res, 'Saldo diperbarui', await adminService.adjustUserBalance(req.params.id, { amount: Number(amount), wallet, note, pin }));
  } catch (e) { next(e); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Akun dihapus', await adminService.deleteUser(req.params.id)); } catch (e) { next(e); }
}

// ===== Broadcast notifikasi (FCM + in-app) =====
export async function broadcastNotification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { audiences, title, body } = req.body || {};
    successResponse(res, 'Notifikasi dikirim', await notificationService.broadcast({ audiences, title, body }));
  } catch (e) { next(e); }
}
export async function listBroadcasts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Riwayat broadcast', await notificationService.listBroadcasts()); } catch (e) { next(e); }
}

// ===== Live Chat Support (CS) =====
export async function supportList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Tiket', await supportService.adminList(req.query.status as string | undefined)); } catch (e) { next(e); }
}
export async function supportGet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Tiket', await supportService.adminGet(req.params.id)); } catch (e) { next(e); }
}
export async function supportReply(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Terkirim', await supportService.adminReply(req.params.id, String(req.body?.body ?? ''))); } catch (e) { next(e); }
}
export async function supportClose(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Tiket ditutup', await supportService.adminClose(req.params.id)); } catch (e) { next(e); }
}

// ===== RBAC: kelola akun admin (superadmin only) =====
export async function listAdmins(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Admins', await adminService.listAdmins()); } catch (e) { next(e); }
}
export async function createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Admin dibuat', await adminService.createAdmin(req.body ?? {})); } catch (e) { next(e); }
}
export async function updateAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Admin diperbarui', await adminService.updateAdmin(req.params.id, req.user!.userId, req.body ?? {})); } catch (e) { next(e); }
}
export async function deleteAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Admin dihapus', await adminService.deleteAdmin(req.params.id, req.user!.userId)); } catch (e) { next(e); }
}

// ===== Voucher (kupon transaksi) — izin 'vouchers' =====
import * as voucherService from '../services/voucher.service';
export async function listVouchers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Vouchers', await voucherService.listAll()); } catch (e) { next(e); }
}
export async function createVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Voucher dibuat', await voucherService.create(req.body ?? {})); } catch (e) { next(e); }
}
export async function updateVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Voucher diperbarui', await voucherService.update(req.params.id, req.body ?? {})); } catch (e) { next(e); }
}
export async function deleteVoucher(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Voucher dihapus', await voucherService.remove(req.params.id)); } catch (e) { next(e); }
}
