/**
 * Cek jalur uang PPOB: refund tepat SEKALI walau callback/cek-status datang berkali-kali,
 * markup harga, dan verifikasi signature webhook.
 * Jalankan: npx tsx src/scripts/check-ppob.ts   (butuh DB lokal)
 * Data uji dibuat & dihapus sendiri.
 */
import assert from 'node:assert';
import crypto from 'node:crypto';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { applyResult, markup, pascaPricing } from '../services/ppob.service';
import { verifyWebhook } from '../utils/digiflazz';

async function main() {
  // 1. Markup: 3% + Rp500, dibulatkan ke atas per Rp100.
  const s = { ppob_markup_percent: '3', ppob_markup_flat: '500' };
  assert.strictEqual(markup(10000, s), 10800); // 10300 + 500 = 10800
  assert.strictEqual(markup(19850, s), 21000); // 20445.5 + 500 = 20945.5 → 21000
  assert.strictEqual(markup(1000, { ppob_markup_percent: '0', ppob_markup_flat: '0' }), 1000);

  // 1b. Harga tagihan pascabayar: pelanggan bayar selling_price, modal = price,
  // dan tidak pernah jual di bawah modal walau vendor mengirim angka aneh.
  assert.deepStrictEqual(pascaPricing({ price: 106000, selling_price: 108500 }), { cost: 106000, sell: 108500 });
  assert.deepStrictEqual(pascaPricing({ price: 106000 }), { cost: 106000, sell: 106000 });
  assert.deepStrictEqual(pascaPricing({ price: 106000, selling_price: 1000 }), { cost: 106000, sell: 106000 });
  assert.deepStrictEqual(pascaPricing({}), { cost: 0, sell: 0 }); // ditolak pemanggil sebagai "tidak terbaca"

  // 2. Signature webhook.
  const body = JSON.stringify({ data: { ref_id: 'X' } });
  const secret = 'rahasia';
  const sig = 'sha1=' + crypto.createHmac('sha1', secret).update(body).digest('hex');
  assert.ok(verifyWebhook(body, sig, secret), 'signature benar harus lolos');
  assert.ok(!verifyWebhook(body, sig, 'salah'), 'secret salah harus ditolak');
  assert.ok(!verifyWebhook(body, 'sha1=deadbeef', secret), 'signature palsu harus ditolak');
  assert.ok(!verifyWebhook(body, sig, ''), 'tanpa secret harus ditolak');

  // 3. Refund sekali saja.
  const user = await prisma.user.create({
    data: {
      email: 'ppob-check@example.test', password: 'x', phone: '08000000999',
      name: 'PPOB Check', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE,
      customer: { create: { balance: 0 } }, // saldo sudah terpotong saat beli
    },
    include: { customer: true },
  });
  const customerId = user.customer!.id;
  const refId = 'PPOB-CHECK-1';
  await prisma.ppobTransaction.create({
    data: {
      customerId, refId, sku: 'test', productName: 'Uji', customerNo: '081200000000',
      costPrice: 10000, sellPrice: 10800, status: 'PENDING',
    },
  });

  try {
    const gagal = { ref_id: refId, customer_no: '081200000000', buyer_sku_code: 'test', message: 'Gagal', status: 'Gagal', rc: '02' };
    await applyResult(refId, gagal as any);
    await applyResult(refId, gagal as any); // callback ganda
    await applyResult(refId, gagal as any);

    const c = await prisma.customer.findUnique({ where: { id: customerId } });
    assert.strictEqual(Number(c!.balance), 10800, 'saldo harus dikembalikan tepat sekali');
    const t = await prisma.ppobTransaction.findUnique({ where: { refId } });
    assert.strictEqual(t!.status, 'FAILED');
    assert.strictEqual(t!.refunded, true);

    // Sukses susulan tidak boleh menimpa status final / menarik saldo lagi.
    await applyResult(refId, { ...gagal, status: 'Sukses', rc: '00', sn: 'SN123' } as any);
    const c2 = await prisma.customer.findUnique({ where: { id: customerId } });
    assert.strictEqual(Number(c2!.balance), 10800, 'status final tidak boleh berubah');
    assert.strictEqual((await prisma.ppobTransaction.findUnique({ where: { refId } }))!.status, 'FAILED');
  } finally {
    await prisma.user.delete({ where: { id: user.id } }); // cascade ke customer + transaksi
  }

  console.log('OK: markup, signature webhook, refund sekali saja');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
