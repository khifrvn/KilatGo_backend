/**
 * Cek pengiriman email reset sandi lewat Brevo:
 * (1) MAIL_FROM "Nama <email>" dipecah jadi name+email — Brevo menolak string gabungan,
 * (2) MAIL_FROM tanpa nama tetap valid,
 * (3) body Brevo memakai nama field yang benar (sender/htmlContent/textContent,
 *     bukan from/html) dan header `api-key`, bukan `Bearer` — salah nama field
 *     berujung 400 dari Brevo dan email tidak pernah terkirim,
 * (4) tombol kirim tidak pernah melempar walau provider membalas error.
 * Jalankan: npx tsx src/scripts/check-mailer.ts   (tidak butuh DB, tidak kirim email asli)
 */
import assert from 'node:assert';
import { isMailConfigured, parseFrom, sendMail } from '../utils/mailer';

async function main() {
  // (1) + (2) pemisahan MAIL_FROM.
  assert.deepEqual(parseFrom('KilatGo <no-reply@kilatgo.com>'), {
    name: 'KilatGo',
    email: 'no-reply@kilatgo.com',
  });
  assert.deepEqual(parseFrom('no-reply@kilatgo.com'), { email: 'no-reply@kilatgo.com' });
  assert.deepEqual(parseFrom('  KilatGo  < no-reply@kilatgo.com >  '), {
    name: 'KilatGo',
    email: 'no-reply@kilatgo.com',
  });

  // (3) bentuk request Brevo — fetch disadap, tidak ada email yang benar-benar terkirim.
  const calls: { url: string; init: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: true, status: 201, text: async () => '' } as unknown as Response;
  }) as typeof fetch;

  process.env.MAIL_FROM = 'KilatGo <no-reply@kilatgo.com>';
  process.env.BREVO_API_KEY = 'dummy-key';

  assert.equal(isMailConfigured(), true, 'dengan kunci Brevo harus dianggap terkonfigurasi');

  const sent = await sendMail({
    to: 'user@example.test',
    subject: 'Reset sandi',
    text: 'teks biasa',
    html: '<p>html</p>',
  });
  assert.equal(sent, true, 'Brevo 201 harus dianggap sukses');

  assert.equal(calls.length, 1, 'harus tepat satu panggilan HTTP');
  assert.equal(calls[0].url, 'https://api.brevo.com/v3/smtp/email');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['api-key'], 'dummy-key', 'Brevo memakai header api-key');
  assert.equal(headers.Authorization, undefined, 'Bearer akan ditolak Brevo');

  const body = JSON.parse(String(calls[0].init.body));
  assert.deepEqual(body.sender, { name: 'KilatGo', email: 'no-reply@kilatgo.com' });
  assert.deepEqual(body.to, [{ email: 'user@example.test' }]);
  assert.equal(body.htmlContent, '<p>html</p>');
  assert.equal(body.textContent, 'teks biasa');
  assert.equal(body.html, undefined, 'field `html` bukan milik Brevo');

  // (4) provider menolak → false, tapi tidak melempar ke pemanggil.
  calls.length = 0;
  globalThis.fetch = (async () => ({
    ok: false,
    status: 401,
    text: async () => '{"message":"Key not found"}',
  })) as unknown as typeof fetch;
  assert.equal(await sendMail({ to: 'a@b.test', subject: 's', text: 't', html: 'h' }), false);

  // Tanpa kunci sama sekali: email dilewati, bukan gagal.
  globalThis.fetch = realFetch;
  delete process.env.BREVO_API_KEY;
  assert.equal(isMailConfigured(), false);
  assert.equal(await sendMail({ to: 'a@b.test', subject: 's', text: 't', html: 'h' }), false);

  console.log('OK: mailer (Brevo) lolos semua pemeriksaan');
}

main().catch((e) => {
  console.error('GAGAL:', e);
  process.exit(1);
});
