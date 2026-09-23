import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/error.middleware';
import { maintenanceGate } from './middleware/maintenance.middleware';
import { isAllowedOrigin, parseOrigins } from './utils/cors';
import { MENU_UPLOAD_DIR, PROOF_UPLOAD_DIR, LOGO_UPLOAD_DIR, PROMO_UPLOAD_DIR, AVATAR_UPLOAD_DIR, MUSIC_UPLOAD_DIR } from './config/upload';

dotenv.config();

// Route imports
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import orderRoutes from './routes/order.routes';
import voucherRoutes from './routes/voucher.routes';
import promoRoutes from './routes/promo.routes';
import trackingRoutes from './routes/tracking.routes';
import paymentRoutes from './routes/payment.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import merchantRoutes from './routes/merchant.routes';
import attendanceRoutes from './routes/attendance.routes';
import errorRoutes from './routes/error.routes';
import settingRoutes from './routes/setting.routes';
import walletRoutes from './routes/wallet.routes';
import packageRoutes from './routes/package.routes';
import supportRoutes from './routes/support.routes';
import customerRoutes from './routes/customer.routes';
import ppobRoutes from './routes/ppob.routes';
import passwordResetPageRoutes from './routes/passwordResetPage.routes';
import { startPaymentExpirySweeper } from './services/payment.service';
import { startRedispatchSweeper } from './services/dispatch.service';
import { startStaleOrderSweeper } from './services/order.service';
import { startPackageExpirySweeper } from './services/driverPackage.service';
import { startRejectedDriverPurgeSweeper } from './services/user.service';
import { startPpobPendingSweeper } from './services/ppob.service';

const app = express();

// Batalkan otomatis order e-Wallet yang ditinggal tanpa dibayar (di app.ts agar
// selalu jalan apa pun entry file-nya).
startPaymentExpirySweeper();
// Re-tawarkan order yang belum dapat driver (termasuk FOOD MERCHANT_ACCEPTED) — self-healing.
startRedispatchSweeper();
// Batalkan order yang terlalu lama tak dapat driver.
startStaleOrderSweeper();
// Batalkan paket Mitra Driver yang belum dibayar > 24 jam.
startPackageExpirySweeper();
// Hapus pendaftaran driver yang ditolak > 3 hari (bebaskan email/HP untuk daftar ulang).
startRejectedDriverPurgeSweeper();
// Cek ulang transaksi PPOB yang menggantung (jaring pengaman kalau webhook tak masuk).
startPpobPendingSweeper();

// Header keamanan dasar. CSP dimatikan: admin panel memuat skrip & style inline,
// dan CSP yang salah kunci mematikan panelnya diam-diam — nyalakan belakangan
// setelah policy-nya diuji. CORP dilonggarkan agar foto menu/logo tetap bisa
// ditampilkan dari origin lain.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS: app mobile tidak mengirim header Origin sehingga selalu lolos; browser
// hanya diizinkan dari origin terdaftar. Admin panel produksi disajikan express
// ini sendiri (same-origin), jadi tidak butuh entri apa pun.
const corsOpts = {
  allowed: parseOrigins(process.env.CORS_ORIGINS),
  isProduction: process.env.NODE_ENV === 'production',
};
app.use(
  cors({
    // Origin asing cukup tidak diberi header CORS — browser yang memblokirnya.
    // Melempar Error di sini justru membuat preflight dijawab 500, yang terbaca
    // seperti server rusak padahal cuma origin tidak terdaftar.
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin, corsOpts)),
  })
);
// rawBody disimpan untuk verifikasi signature webhook (Digiflazz HMAC-SHA1 atas body mentah).
app.use(express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'kilatgo-backend', timestamp: new Date().toISOString() });
});

// Halaman return top-up (dibuka di WebView app; app mendeteksi URL ini lalu menutup).
const topupPage = (title: string, msg: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px 24px;color:#0f172a"><h2 style="margin:0 0 8px">${title}</h2><p style="color:#64748b">${msg}</p></body></html>`;
app.get('/topup/done', (_req, res) => res.send(topupPage('Pembayaran diproses', 'Kembali ke aplikasi — saldo bertambah otomatis setelah pembayaran dikonfirmasi.')));
app.get('/topup/cancel', (_req, res) => res.send(topupPage('Pembayaran dibatalkan', 'Kembali ke aplikasi untuk mencoba lagi.')));

// Admin panel (CMS) — dibuild ke cms/dist saat deploy. __dirname = dist/ setelah tsc.
const cmsDist = path.join(__dirname, '../cms/dist');
app.use(express.static(cmsDist));
// Foto menu publik — HARUS di atas SPA fallback agar tidak dikembalikan index.html.
app.use('/uploads/menus', express.static(MENU_UPLOAD_DIR));
app.use('/uploads/proofs', express.static(PROOF_UPLOAD_DIR));
app.use('/uploads/logos', express.static(LOGO_UPLOAD_DIR));
app.use('/uploads/promos', express.static(PROMO_UPLOAD_DIR));
app.use('/uploads/avatars', express.static(AVATAR_UPLOAD_DIR));
// Musik layar perbaikan — di atas gate maintenance supaya tetap bisa diputar.
app.use('/uploads/music', express.static(MUSIC_UPLOAD_DIR));
// Halaman web reset password (tautan di email). WAJIB di atas SPA fallback CMS,
// kalau tidak /reset-password akan dilayani index.html panel admin.
app.use(passwordResetPageRoutes);

// SPA fallback: semua GET non-API kembalikan index.html (react-router). Di ATAS gate
// supaya panel admin tetap bisa dimuat untuk mematikan maintenance mode.
app.get(/^\/(?!api\/|api$|health$).*/, (_req, res) => res.sendFile(path.join(cmsDist, 'index.html')));

// Blokir request non-admin saat maintenance mode aktif
app.use(maintenanceGate);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/ppob', ppobRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Error handler
app.use(errorHandler);

export default app;
