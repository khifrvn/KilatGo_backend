/**
 * Cek pagar keamanan yang tidak menyentuh DB:
 *  - limiter PPOB memblokir di ambang batas DAN jatahnya per user (bug klasik:
 *    satu bucket dipakai bersama, satu pelanggan boros memblokir semua);
 *  - CORS menolak origin asing tapi tetap meloloskan app mobile (tanpa Origin).
 * Jalankan: npx tsx src/scripts/check-security.ts
 */
import assert from 'node:assert';
import express from 'express';
import { ppobBuyLimiter } from '../middleware/rateLimit.middleware';
import { isAllowedOrigin, parseOrigins } from '../utils/cors';
import { buildCustomerNo } from '../services/ppob.service';

function checkCors() {
  const allowed = parseOrigins(' https://cms.kilatgo.com , https://kilatgo.com ');
  assert.deepStrictEqual(allowed, ['https://cms.kilatgo.com', 'https://kilatgo.com']);

  const prod = { allowed, isProduction: true };
  assert.ok(isAllowedOrigin(undefined, prod), 'app mobile tidak kirim Origin — harus lolos');
  assert.ok(isAllowedOrigin('https://cms.kilatgo.com', prod), 'origin terdaftar harus lolos');
  assert.ok(!isAllowedOrigin('https://jahat.com', prod), 'origin asing harus ditolak');
  assert.ok(!isAllowedOrigin('http://localhost:5173', prod), 'localhost tidak boleh lolos di production');

  const dev = { allowed: [], isProduction: false };
  assert.ok(isAllowedOrigin('http://localhost:5173', dev), 'dev server CMS harus lolos di luar production');
  assert.ok(!isAllowedOrigin('https://jahat.com', dev), 'origin asing tetap ditolak di dev');

  console.log('OK: CORS meloloskan app mobile & origin terdaftar, menolak sisanya');
}

function checkCustomerNo() {
  const withSep = (sep: string) => ({ ppob_game_id_separator: sep });

  // Tanpa zone → apa adanya. Spasi & strip dirapikan.
  assert.strictEqual(buildCustomerNo('0812 3456-7890', undefined, {}), '081234567890');
  assert.strictEqual(buildCustomerNo('12345678', '', {}), '12345678');

  // Dengan zone → digabung sesuai setting.
  assert.strictEqual(buildCustomerNo('12345678', '1234', withSep('')), '123456781234');
  assert.strictEqual(buildCustomerNo('12345678', '1234', withSep('.')), '12345678.1234');
  assert.strictEqual(buildCustomerNo('12345678', '1234', withSep('|')), '12345678|1234');

  // Input kotor ditolak sebelum menyentuh vendor.
  assert.throws(() => buildCustomerNo('abc', undefined, {}), /tidak valid/);
  assert.throws(() => buildCustomerNo('123', undefined, {}), /tidak valid/); // < 4 digit
  assert.throws(() => buildCustomerNo('12345678', 'abcd', {}), /Zone/);
  // Setting diisi ngawur tidak boleh lolos ke customer_no vendor.
  assert.throws(() => buildCustomerNo('12345678', '1234', withSep('; DROP')), /belum dikonfigurasi/);

  console.log('OK: customer_no dirakit sesuai setting & menolak input tidak valid');
}

async function main() {
  checkCors();
  checkCustomerNo();

  const app = express();
  // Berdiri di posisi authenticateToken: limiter selalu jalan setelah user dikenali.
  app.use((req, _res, next) => {
    (req as any).user = { userId: req.headers['x-uid'] as string };
    next();
  });
  app.post('/buy', ppobBuyLimiter, (_req, res) => {
    res.json({ ok: true });
  });

  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const port = (server.address() as any).port;
  const hit = (uid: string) =>
    fetch(`http://127.0.0.1:${port}/buy`, { method: 'POST', headers: { 'x-uid': uid } }).then((r) => r.status);

  try {
    const andi = [];
    for (let i = 0; i < 6; i++) andi.push(await hit('andi'));
    assert.deepStrictEqual(andi, [200, 200, 200, 200, 200, 429], `5 lolos lalu diblokir, dapat ${andi}`);

    // Jatah Budi harus utuh walau Andi sudah kena blokir.
    assert.strictEqual(await hit('budi'), 200, 'limit harus per user, bukan global');
  } finally {
    server.close();
  }

  console.log('OK: limiter memblokir di ambang batas & terpisah per user');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
