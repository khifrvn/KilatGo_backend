import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { sendMail, isMailConfigured } from '../utils/mailer';

/// Tautan reset berlaku 60 menit — cukup untuk membuka email, tidak cukup lama
/// untuk dipakai ulang dari kotak masuk lama.
const TOKEN_TTL_MS = 60 * 60 * 1000;

/// Token mentah 32 byte (256 bit) acak. Yang disimpan di DB hanya hash-nya.
const newToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/// Base URL publik backend, dipakai untuk membentuk tautan di email.
const appUrl = () => (process.env.APP_URL || 'https://api.kilatgo.com').replace(/\/+$/, '');

const resetLink = (token: string) => `${appUrl()}/reset-password?token=${token}`;

/**
 * Buat token reset untuk email terdaftar lalu kirim tautannya.
 *
 * Tidak pernah melempar untuk email tak dikenal dan tidak pernah membocorkan
 * apakah email itu ada: kalau endpoint ini membedakan keduanya, ia berubah jadi
 * alat untuk memeriksa email mana yang terdaftar.
 *
 * Mengembalikan token mentah (atau null bila tak ada email yang cocok) supaya
 * pemanggil non-HTTP bisa melanjutkan alurnya — dipakai skrip cek & log
 * pengembangan. Pengiriman email tidak memakai nilai kembalian ini.
 */
export async function requestPasswordReset(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Email tak terdaftar/akun diblokir → selesai tanpa jejak (respons tetap sama).
  if (!user || user.status === UserStatus.SUSPENDED) return null;

  // Token lama dibuang supaya tautan yang lebih tua tidak bisa dipakai lagi dan
  // tabelnya tidak menumpuk. Sekaligus membuat token terbaru jadi satu-satunya
  // yang berlaku kalau pengguna meminta berulang kali.
  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

  const token = newToken();
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  // Tanpa provider email, tautan di-log supaya alur tetap bisa dicoba manual.
  // Hanya di luar produksi: di produksi log bisa dibaca staf hosting, dan tautan
  // reset yang hidup di log = kredensial bocor. Di produksi cukup beri peringatan.
  if (!isMailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`[MAIL SKIP] Email provider belum dikonfigurasi — tautan reset ${email} tidak terkirim`);
    } else {
      console.warn(`[MAIL SKIP] Tautan reset untuk ${email}: ${resetLink(token)}`);
    }
  }

  await sendMail({
    to: user.email,
    subject: 'Atur Ulang Password KilatGo',
    text: [
      `Halo ${user.name},`,
      '',
      'Kami menerima permintaan untuk mengatur ulang password akun KilatGo Anda.',
      'Buka tautan berikut untuk membuat password baru:',
      '',
      resetLink(token),
      '',
      'Tautan berlaku 60 menit dan hanya bisa dipakai sekali.',
      'Kalau Anda tidak meminta ini, abaikan saja email ini — password Anda tidak berubah.',
    ].join('\n'),
    html: resetEmailHtml(user.name, resetLink(token)),
  });

  return token;
}

/**
 * Pakai token untuk menetapkan password baru.
 *
 * Token ditandai terpakai (bukan dihapus) agar percobaan ulang dengan tautan
 * yang sama dijawab "tautan sudah kedaluwarsa", bukan "token tidak dikenal".
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    throw new AppError('Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.', 400);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        password: hashedPassword,
        // Mencabut semua token yang terbit sebelum sekarang (lihat auth.middleware).
        passwordChangedAt: new Date(),
      },
    }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
}

function resetEmailHtml(name: string, link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:24px;padding:32px 28px">
      <h2 style="margin:0 0 8px;color:#0f172a">Atur Ulang Password</h2>
      <p style="color:#64748b;line-height:1.6;margin:0 0 8px">Halo ${name},</p>
      <p style="color:#64748b;line-height:1.6;margin:0 0 24px">
        Kami menerima permintaan untuk mengatur ulang password akun KilatGo Anda.
        Klik tombol di bawah untuk membuat password baru.
      </p>
      <a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:14px 28px;border-radius:28px;font-weight:700">
        Buat Password Baru
      </a>
      <p style="color:#94a3b8;font-size:12px;line-height:1.6;margin:24px 0 0">
        Tautan berlaku 60 menit dan hanya bisa dipakai sekali.<br>
        Kalau Anda tidak meminta ini, abaikan saja email ini — password Anda tidak berubah.
      </p>
    </div>
  </div>
</body></html>`;
}
