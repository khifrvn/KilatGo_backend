import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { errorResponse } from '../utils/response';

// Dikunci per user, bukan per IP: token yang bocor dipakai dari mana saja, dan
// banyak pelanggan berbagi IP di balik NAT operator seluler. Jatuh ke IP hanya
// untuk endpoint tanpa auth. ipKeyGenerator dipakai supaya IPv6 dinormalkan.
const byUser = (req: Request) => req.user?.userId ?? ipKeyGenerator(req.ip ?? '');

const limiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    limit: max,
    keyGenerator: byUser,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => errorResponse(res, message, 429),
  });

/// Pembelian PPOB: tiap panggilan memotong saldo asli, jadi dibatasi ketat.
export const ppobBuyLimiter = limiter(
  60 * 1000,
  5,
  'Terlalu banyak percobaan pembelian. Coba lagi sebentar lagi.'
);

/// Cek nomor meter juga memanggil vendor — batasi supaya tidak jadi alat
/// enumerasi nomor meter orang lain lewat API kita.
export const ppobInquiryLimiter = limiter(
  60 * 1000,
  15,
  'Terlalu sering memeriksa nomor. Tunggu sebentar ya.'
);

/// Cek status meneruskan permintaan ke Digiflazz, dan vendor melarang cek ulang
/// terlalu rapat — batasi walau app-nya sendiri sudah polling dengan jeda.
export const ppobStatusLimiter = limiter(
  60 * 1000,
  20,
  'Terlalu sering memeriksa status. Tunggu sebentar ya.'
);

/// Minta tautan reset & pakai token reset dibatasi per IP (endpoint ini belum
/// ber-auth). Dua limiter terpisah — kalau digabung, percobaan reset yang gagal
/// ikut menghabiskan kuota permintaan tautan, sehingga pengguna yang salah ketik
/// justru terkunci dari meminta tautan baru.
export const forgotPasswordLimiter = limiter(
  15 * 60 * 1000,
  5,
  'Terlalu banyak permintaan tautan reset. Coba lagi beberapa menit lagi.'
);

/// Lebih longgar dari permintaan tautan: pengguna wajar mencoba beberapa kali
/// kalau tokennya kedaluwarsa, tapi tetap dibatasi agar token tidak bisa ditebak.
export const resetPasswordLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.'
);
