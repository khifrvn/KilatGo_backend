import { Router, Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middleware/auth.middleware';
import { ppobBuyLimiter, ppobInquiryLimiter, ppobStatusLimiter } from '../middleware/rateLimit.middleware';
import * as ppobService from '../services/ppob.service';
import { getDigiflazzConfig } from '../services/settings.service';
import { verifyWebhook } from '../utils/digiflazz';
import { successResponse } from '../utils/response';

const router = Router();
// PPOB dipakai pelanggan (saldo KilatGo), driver (Dompet Pendapatan/Kredit),
// dan mitra (saldo mitra). Dompet mana yang dipotong ditentukan service dari
// userId, bukan dari request.
const buyers = [authenticateToken, authorizeRoles(UserRole.CUSTOMER, UserRole.DRIVER, UserRole.MERCHANT)];

// Saldo dompet yang dipakai membayar — app menampilkannya sebelum memilih produk.
router.get('/balance', ...buyers, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Saldo PPOB', await ppobService.balanceOf(req.user!.userId)); } catch (e) { next(e); }
});

// Kategori + brand yang tersedia (untuk menu PPOB di app).
router.get('/categories', ...buyers, async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Kategori PPOB', await ppobService.listCategories()); } catch (e) { next(e); }
});

// Daftar produk (harga sudah termasuk markup). Filter ?category=&brand=
router.get('/products', ...buyers, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Produk PPOB', await ppobService.listProducts({
      category: req.query.category as string | undefined,
      brand: req.query.brand as string | undefined,
    }));
  } catch (e) { next(e); }
});

// Cek nomor meter PLN → nama & daya. Dipanggil app sebelum konfirmasi bayar.
router.post('/inquiry/pln', ...buyers, ppobInquiryLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ppobService.inquiryPln(String(req.body?.customerNo ?? ''));
    successResponse(res, 'Data pelanggan PLN', data);
  } catch (e) { next(e); }
});

// ===== Pascabayar (tagihan) =====
// Katalog terpisah dari prepaid: produk tagihan tidak punya harga tetap.
router.get('/pasca/categories', ...buyers, async (_req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Kategori tagihan', await ppobService.listPascaCategories()); } catch (e) { next(e); }
});

router.get('/pasca/products', ...buyers, async (req: Request, res: Response, next: NextFunction) => {
  try {
    successResponse(res, 'Produk tagihan', await ppobService.listPascaProducts({
      category: req.query.category as string | undefined,
      brand: req.query.brand as string | undefined,
    }));
  } catch (e) { next(e); }
});

// Cek ID pelanggan → nama, rincian & nominal tagihan. Tidak memotong saldo.
router.post('/inquiry/pasca', ...buyers, ppobInquiryLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ppobService.inquiryPasca(String(req.body?.sku ?? ''), String(req.body?.customerNo ?? ''));
    successResponse(res, 'Tagihan pelanggan', data);
  } catch (e) { next(e); }
});

// Bayar tagihan. Nominal ditentukan vendor, bukan app; `maxTotal` = total yang
// sudah disetujui pengguna di layar konfirmasi.
router.post('/pay/pasca', ...buyers, ppobBuyLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ppobService.payPasca(
      req.user!.userId,
      String(req.body?.sku ?? ''),
      String(req.body?.customerNo ?? ''),
      req.body?.maxTotal == null ? undefined : Number(req.body.maxTotal),
      req.body?.wallet == null ? undefined : String(req.body.wallet),
    );
    successResponse(res, 'Pembayaran tagihan dibuat', data, 201);
  } catch (e) { next(e); }
});

// Beli — saldo KilatGo dipotong, dikembalikan otomatis bila gagal.
router.post('/buy', ...buyers, ppobBuyLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await ppobService.buy(
      req.user!.userId,
      String(req.body?.sku ?? ''),
      String(req.body?.customerNo ?? ''),
      req.body?.zoneId == null ? undefined : String(req.body.zoneId),
      req.body?.wallet == null ? undefined : String(req.body.wallet),
    );
    successResponse(res, 'Transaksi dibuat', data, 201);
  } catch (e) { next(e); }
});

router.get('/transactions', ...buyers, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Riwayat PPOB', await ppobService.listTransactions(req.user!.userId)); } catch (e) { next(e); }
});

// Cek status (polling saat PENDING — ikut menanyakan ulang ke vendor).
router.get('/transactions/:refId', ...buyers, ppobStatusLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try { successResponse(res, 'Status transaksi', await ppobService.getStatus(req.user!.userId, req.params.refId)); } catch (e) { next(e); }
});

// Webhook Digiflazz (publik). Signature HMAC-SHA1 atas raw body wajib cocok —
// tanpa itu siapa pun bisa menandai transaksi Sukses/Gagal.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const cfg = await getDigiflazzConfig();
    const raw = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
    if (!verifyWebhook(raw, String(req.headers['x-hub-signature'] ?? ''), cfg.webhookSecret)) {
      return res.status(401).json({ ok: false });
    }
    await ppobService.handleWebhook(req.body || {});
  } catch (e) {
    console.error('ppob webhook error', e);
  }
  return res.status(200).json({ ok: true }); // selalu 200 supaya vendor tidak retry berlebihan
});

export default router;
