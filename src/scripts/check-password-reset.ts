/**
 * Cek alur lupa sandi (forgot/reset):
 * (1) email tak terdaftar → tidak melempar dan tidak membuat token (anti-enumerasi),
 * (2) token disimpan sebagai hash, bukan teks asli,
 * (3) minta tautan baru mencabut token lama,
 * (4) token sekali pakai — pemakaian kedua ditolak,
 * (5) token kedaluwarsa ditolak,
 * (6) sandi benar-benar berganti (sandi lama gagal, sandi baru berhasil),
 * (7) reset mencabut refresh token lama, tapi token baru tetap berlaku,
 * (8) aturan pencabutan: token pada detik yang sama tidak ikut tercabut.
 * Jalankan: npx tsx src/scripts/check-password-reset.ts   (butuh DB lokal)
 * Data uji dibuat & dihapus sendiri.
 */
import assert from 'node:assert';
import crypto from 'crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { requestPasswordReset, resetPassword } from '../services/passwordReset.service';
import { login as serviceLogin, refresh as serviceRefresh } from '../services/auth.service';
import { generateRefreshToken } from '../utils/jwt';
import { isTokenRevoked } from '../utils/tokenRevocation';
import { AppError } from '../middleware/error.middleware';

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mustFail = async (run: () => unknown, label: string) => {
  try {
    await run();
  } catch (e) {
    assert.ok(e instanceof AppError, `${label}: harus AppError, dapat ${String(e)}`);
    return;
  }
  throw new Error(`${label}: seharusnya ditolak, tapi berhasil`);
};

async function main() {
  const stamp = Date.now();
  const email = `check.reset.${stamp}@example.test`;
  const oldPassword = 'sandi-lama-123';
  const newPassword = 'sandi-baru-456';

  const user = await prisma.user.create({
    data: {
      email,
      password: oldPassword,
      phone: `08${String(stamp).slice(-10)}`,
      name: 'Check Reset',
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      customer: { create: {} },
    },
  });

  try {
    // (8) aturan pencabutan: detik yang sama masih berlaku, detik sebelumnya tidak.
    const changed = new Date('2026-01-01T00:00:00.500Z');
    const sameSecond = Math.floor(changed.getTime() / 1000);
    assert.equal(isTokenRevoked(changed, sameSecond), false, 'detik sama tidak boleh dicabut');
    assert.equal(isTokenRevoked(changed, sameSecond - 1), true, 'detik sebelumnya harus dicabut');

    // (1) email tak terdaftar → null, tanpa baris token.
    assert.equal(await requestPasswordReset('tidak.terdaftar@example.test'), null, 'email tak terdaftar harus null');

    // Alur normal.
    const token = await requestPasswordReset(email);
    assert.ok(token, 'email terdaftar harus menghasilkan token');
    assert.match(token, /^[a-f0-9]{64}$/, 'token harus 32 byte hex');

    const row = await prisma.passwordReset.findFirst({ where: { userId: user.id } });
    assert.ok(row, 'baris token harus tersimpan');
    // (2) yang tersimpan hanya hash-nya.
    assert.equal(row.tokenHash, sha(token), 'hash token tidak cocok');
    assert.notEqual(row.tokenHash, token, 'token asli tidak boleh tersimpan apa adanya');

    // Refresh token yang terbit SEBELUM reset — harus tercabut setelah reset.
    const staleRefresh = generateRefreshToken({ userId: user.id, email, role: user.role });

    // (3) minta tautan baru → token lama dicabut.
    const token2 = await requestPasswordReset(email);
    assert.ok(token2 && token2 !== token, 'tautan baru harus menghasilkan token berbeda');
    assert.equal(await prisma.passwordReset.count({ where: { userId: user.id } }), 1, 'harus tetap satu token');
    assert.equal(
      await prisma.passwordReset.findFirst({ where: { tokenHash: sha(token) } }),
      null,
      'token lama harus dicabut'
    );

    // iat presisi detik — beri jeda supaya token lama benar-benar lebih tua.
    await sleep(1100);
    await resetPassword(token2, newPassword);

    // (6) sandi berganti.
    await mustFail(() => serviceLogin({ email, password: oldPassword }), 'sandi lama');
    const fresh = await serviceLogin({ email, password: newPassword });
    assert.ok(fresh.accessToken && fresh.refreshToken, 'login sandi baru harus mengembalikan token');

    // (7) sesi lama dicabut, sesi baru tetap jalan.
    await mustFail(() => serviceRefresh(staleRefresh), 'refresh token lama');
    const renewed = await serviceRefresh(fresh.refreshToken);
    assert.ok(renewed.accessToken, 'refresh token baru harus tetap berlaku');

    // (4) sekali pakai.
    await mustFail(() => resetPassword(token2, 'sandi-ketiga-789'), 'token dipakai ulang');

    // (5) kedaluwarsa.
    const expired = await requestPasswordReset(email);
    assert.ok(expired);
    await prisma.passwordReset.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await mustFail(() => resetPassword(expired, 'sandi-keempat-000'), 'token kedaluwarsa');

    console.log('OK: alur lupa sandi lolos semua pemeriksaan');
  } finally {
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
    await prisma.customer.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
