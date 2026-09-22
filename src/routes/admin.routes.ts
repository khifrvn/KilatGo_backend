import { Router, Request, Response, NextFunction } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as promoController from '../controllers/promo.controller';
import * as packageController from '../controllers/driverPackage.controller';
import * as manualOrderController from '../controllers/manualOrder.controller';
import * as topupService from '../services/topup.service';
import * as ppobService from '../services/ppob.service';
import { successResponse } from '../utils/response';
import { AppError } from '../middleware/error.middleware';
import { promoUpload, musicUpload } from '../config/upload';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { requirePermission, requireSuperAdmin } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require admin role
router.use(authenticateToken, authorizeRoles(UserRole.ADMIN));

// Promo/kampanye (customer/driver/mitra)
router.get('/promos', requirePermission('promos'), promoController.list);
router.post('/promos', requirePermission('promos'), promoUpload, promoController.create);
router.patch('/promos/:id', requirePermission('promos'), promoUpload, promoController.update);
router.delete('/promos/:id', requirePermission('promos'), promoController.remove);

router.get('/topups', requirePermission('topups'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Topups', await topupService.listAllTopUps());
  } catch (e) {
    next(e);
  }
});
router.post('/topups/manual', requirePermission('topups'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, targetId, amount, pin, note } = req.body ?? {};
    if (!['CUSTOMER', 'DRIVER', 'MERCHANT'].includes(role)) throw new AppError('Peran tidak valid', 400);
    if (!targetId) throw new AppError('Penerima wajib dipilih', 400);
    const result = await topupService.adminManualTopUp({ role, targetId, amount: Number(amount), pin, note });
    successResponse(res, 'Saldo berhasil ditambahkan', result);
  } catch (e) {
    next(e);
  }
});
// PIN isi saldo manual
router.get('/topup-pin', requirePermission('topups'), async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'PIN status', await topupService.getTopupPinStatus()); } catch (e) { next(e); }
});
router.post('/topup-pin', requirePermission('topups'), async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'PIN dibuat', await topupService.setTopupPin(req.body?.pin)); } catch (e) { next(e); }
});
router.post('/topup-pin/reset', requirePermission('topups'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password, newPin } = req.body ?? {};
    successResponse(res, 'PIN direset', await topupService.resetTopupPin(req.user!.userId, password, newPin));
  } catch (e) { next(e); }
});
// Dasbor boleh semua admin (menu Dasbor selalu tampil).
router.get('/dashboard', adminController.getDashboardStats);
// Badge sidebar: jumlah item butuh tindakan (semua admin boleh; badge hanya tampil di menu yang terlihat).
router.get('/pending-counts', adminController.getPendingCounts);
router.get('/orders', requirePermission('orders'), adminController.getAllOrders);
router.patch('/orders/:id/status', requirePermission('orders'), adminController.updateOrderStatus);
router.get('/earnings', requirePermission('earnings'), adminController.getEarningsReport);
// Rating & ulasan: isi komentar untuk driver, mitra, dan pelanggan.
router.get('/ratings', requirePermission('ratings'), adminController.getRatings);
router.get('/drivers/pending', requirePermission('approval'), adminController.getPendingDrivers);
router.get('/files/:name', requirePermission('approval', 'drivers', 'attendance'), adminController.getDriverDocument);

// Fase 2: merchant approval
router.get('/merchants', requirePermission('merchants', 'topups'), adminController.getMerchants);
router.get('/merchants/pending', requirePermission('approval', 'merchants'), adminController.getPendingMerchants);
router.get('/merchants/:id/report', requirePermission('merchants'), adminController.getMerchantReport);
router.patch('/menus/:id', requirePermission('merchants'), adminController.setMenuAvailability);
router.get('/merchants/:id', requirePermission('merchants'), adminController.getMerchant);
router.post('/merchants/:id/approve', requirePermission('approval', 'merchants'), adminController.approveMerchant);

// Fase 3: absen & KYC
router.get('/attendance', requirePermission('attendance'), adminController.getAttendance);
router.delete('/attendance/:id', requirePermission('attendance'), adminController.deleteAttendance);
router.get('/kyc/customers', requirePermission('approval'), adminController.getCustomerKycList);
router.delete('/kyc/customer/:id', requirePermission('approval'), adminController.resetCustomerKyc);
router.post('/kyc/:subjectType/:subjectId/verify', requirePermission('approval'), adminController.verifyKyc);

// Pengaturan (komisi/tarif) & kendala
router.get('/settings', requirePermission('settings'), adminController.getSettings);
router.put('/settings', requirePermission('settings'), adminController.updateSettings);
router.post('/settings/music', requirePermission('settings'), musicUpload, adminController.uploadMaintenanceMusic);

// Penarikan saldo driver
router.get('/withdrawals', requirePermission('withdrawals'), adminController.getWithdrawals);
router.post('/withdrawals/:id/approve', requirePermission('withdrawals'), adminController.approveWithdrawal);
router.post('/withdrawals/:id/reject', requirePermission('withdrawals'), adminController.rejectWithdrawal);

// Log error
router.get('/errors', requirePermission('errors'), adminController.getErrors);
router.delete('/errors', requirePermission('errors'), adminController.clearErrors);
router.post('/users/:id/suspend', requirePermission('customers', 'drivers'), adminController.suspendUser);
router.post('/users/:id/activate', requirePermission('customers', 'drivers'), adminController.activateUser);

// Voucher (kupon transaksi)
router.get('/vouchers', requirePermission('vouchers'), adminController.listVouchers);
router.post('/vouchers', requirePermission('vouchers'), adminController.createVoucher);
router.patch('/vouchers/:id', requirePermission('vouchers'), adminController.updateVoucher);
router.delete('/vouchers/:id', requirePermission('vouchers'), adminController.deleteVoucher);

// Order manual (dibuat admin utk pelanggan yang order via WhatsApp).
router.get('/manual-orders/online-drivers', requirePermission('manual_orders'), manualOrderController.onlineDrivers);
router.get('/manual-orders/search-customers', requirePermission('manual_orders'), manualOrderController.searchCustomers);
router.get('/manual-orders', requirePermission('manual_orders'), manualOrderController.list);
router.post('/manual-orders', requirePermission('manual_orders'), manualOrderController.create);
router.get('/manual-orders/:id', requirePermission('manual_orders'), manualOrderController.detail);
router.patch('/manual-orders/:id/price', requirePermission('manual_orders'), manualOrderController.updatePrice);
router.post('/manual-orders/:id/payment-link', requirePermission('manual_orders'), manualOrderController.paymentLink);
router.post('/manual-orders/:id/confirm-payment', requirePermission('manual_orders'), manualOrderController.confirmPayment);
router.post('/manual-orders/:id/dispatch', requirePermission('manual_orders'), manualOrderController.dispatch);

// Paket Mitra Driver: kelola harga + pesanan + status.
router.get('/packages/price', requirePermission('packages'), packageController.adminGetPrice);
router.put('/packages/price', requirePermission('packages'), packageController.adminSetPrice);
router.get('/packages', requirePermission('packages'), packageController.adminList);
router.patch('/packages/:id', requirePermission('packages'), packageController.adminUpdate);

// Live Chat Support (CS): inbox tiket + balas + tutup.
router.get('/support', requirePermission('support'), adminController.supportList);
router.get('/support/:id', requirePermission('support'), adminController.supportGet);
router.post('/support/:id/reply', requirePermission('support'), adminController.supportReply);
router.post('/support/:id/close', requirePermission('support'), adminController.supportClose);

// Broadcast notifikasi (FCM + in-app) ke Customer/Driver/Merchant.
router.post('/notifications/broadcast', requirePermission('notifications'), adminController.broadcastNotification);
router.get('/notifications/broadcast', requirePermission('notifications'), adminController.listBroadcasts);

// PPOB (Digiflazz): riwayat transaksi, saldo deposit vendor, refresh katalog.
router.get('/ppob/transactions', requirePermission('ppob'), async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Transaksi PPOB', await ppobService.adminListTransactions(req.query.status as string | undefined)); } catch (e) { next(e); }
});
router.get('/ppob/vendor-balance', requirePermission('ppob'), async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Saldo vendor', await ppobService.adminVendorBalance()); } catch (e) { next(e); }
});
router.post('/ppob/refresh-catalog', requirePermission('ppob'), async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Katalog diperbarui', await ppobService.adminRefreshCatalog()); } catch (e) { next(e); }
});
// Katalog mentah vendor + SKU mana yang dijual di app.
router.get('/ppob/catalog', requirePermission('ppob'), async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Katalog PPOB', await ppobService.adminCatalog()); } catch (e) { next(e); }
});
router.put('/ppob/active-skus', requirePermission('ppob'), async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Produk aktif disimpan', await ppobService.setActiveSkus(req.body?.skus)); } catch (e) { next(e); }
});

// Akses semua akun (bantuan helpdesk: profil/saldo/kata sandi). Superadmin only.
router.get('/users/:id/account', requireSuperAdmin, adminController.getUserAccount);
router.patch('/users/:id/account', requireSuperAdmin, adminController.updateUserAccount);
router.post('/users/:id/balance', requireSuperAdmin, adminController.adjustUserBalance);
router.delete('/users/:id', requireSuperAdmin, adminController.deleteUser);

// RBAC: kelola akun admin (superadmin only)
router.get('/admins', requireSuperAdmin, adminController.listAdmins);
router.post('/admins', requireSuperAdmin, adminController.createAdmin);
router.patch('/admins/:id', requireSuperAdmin, adminController.updateAdmin);
router.delete('/admins/:id', requireSuperAdmin, adminController.deleteAdmin);

export default router;
