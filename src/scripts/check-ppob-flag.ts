/**
 * Cek gerbang fitur PPOB (saklar "Aktifkan layanan PPOB" di CMS):
 * (1) flag `ppob_enabled` benar-benar ikut ke client lewat /settings/public,
 *     tanpa membocorkan kredensial/mode/margin/webhook secret,
 * (2) katalog/inquiry/order ditolak saat fitur mati,
 * (3) webhook & cek status TETAP jalan saat fitur mati — transaksi PENDING
 *     harus tetap bisa ditutup (refund), kalau tidak saldo pelanggan nyangkut.
 * Jalankan: npx tsx src/scripts/check-ppob-flag.ts   (butuh DB lokal)
 * Data uji dibuat & dihapus sendiri; nilai asli `ppob_enabled` dipulihkan.
 */
import assert from 'node:assert';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { getPublicSettings, getSettings, updateSettings } from '../services/settings.service';
import { handleWebhook, inquiryPln, listProducts, buy, getStatus, listTransactions } from '../services/ppob.service';

const mustFail = async (fn: () => Promise<unknown>, code: number, label: string) => {
  try {
    await fn();
  } catch (e: any) {
    assert.strictEqual(e.statusCode, code, `${label}: status harus ${code}, dapat ${e.statusCode} (${e.message})`);
    return e;
  }
  throw new Error(`${label}: seharusnya ditolak, tapi berhasil`);
};

async function main() {
  const original = (await getSettings()).ppob_enabled;

  try {
    // ===== 1. Flag ikut ke client, kredensial tidak =====
    const pub = await getPublicSettings();
    assert.ok('ppob_enabled' in pub, 'ppob_enabled harus ada di /settings/public');
    assert.ok(pub.ppob_enabled === '0' || pub.ppob_enabled === '1', 'ppob_enabled harus "0"/"1"');
    for (const rahasia of [
      'digiflazz_username', 'digiflazz_dev_key', 'digiflazz_prod_key',
      'digiflazz_mode', 'digiflazz_webhook_secret', 'ppob_markup_percent', 'ppob_markup_flat',
    ]) {
      assert.ok(!(rahasia in pub), `${rahasia} TIDAK boleh ikut ke client`);
    }

    // ===== 2. Fitur MATI: katalog/inquiry/order ditolak =====
    await updateSettings({ ppob_enabled: '0' });

    for (const [label, call] of [
      ['listProducts', () => listProducts()],
      ['buy', () => buy('no-such-user', 'X', '081200000000')],
    ] as const) {
      const e = await mustFail(call as () => Promise<unknown>, 503, `${label} saat PPOB mati`);
      assert.ok(e.message.includes('belum tersedia'), `${label}: pesan harus jelas ke pengguna`);
    }
    // inquiryPln yang mati ditolak SEBELUM nomor diperiksa (tidak menyentuh vendor).
    await mustFail(() => inquiryPln('123456'), 503, 'inquiry/pln saat PPOB mati');

    // ===== 3. Fitur HIDUP: gerbangnya terbuka =====
    // Pembedanya pesan, bukan status: saat mati → "Fitur PPOB belum tersedia";
    // saat hidup → lanjut ke cek berikutnya ("PPOB belum dikonfigurasi" bila
    // kredensial vendor masih kosong). Keduanya 503, jadi jangan andalkan kode.
    await updateSettings({ ppob_enabled: '1' });
    const hidup = await mustFail(() => inquiryPln('123456'), 503, 'inquiry/pln saat PPOB hidup');
    assert.ok(
      !hidup.message.includes('belum tersedia'),
      `saat PPOB hidup, pesannya bukan "belum tersedia" (dapat: ${hidup.message})`,
    );

    // ===== 4. Fitur MATI: webhook & cek status TETAP jalan =====
    await updateSettings({ ppob_enabled: '0' });

    const user = await prisma.user.create({
      data: {
        email: 'ppob-flag@example.test', password: 'x', phone: '08000000888',
        name: 'PPOB Flag', role: UserRole.CUSTOMER, status: UserStatus.ACTIVE,
        customer: { create: { balance: 0 } }, // saldo sudah terpotong saat beli
      },
      include: { customer: true },
    });
    const customerId = user.customer!.id;
    const refId = 'PPOB-FLAG-1';

    try {
      await prisma.ppobTransaction.create({
        data: {
          customerId, refId, sku: 'test', productName: 'Uji', customerNo: '081200000000',
          costPrice: 10000, sellPrice: 10800, status: 'PENDING',
        },
      });

      // Webhook tidak boleh diblokir gerbang: transaksi PENDING wajib bisa ditutup.
      await handleWebhook({
        data: { ref_id: refId, customer_no: '081200000000', buyer_sku_code: 'test', message: 'Gagal', status: 'Gagal', rc: '02' },
      });

      const t = await prisma.ppobTransaction.findUnique({ where: { refId } });
      assert.strictEqual(t!.status, 'FAILED', 'webhook harus tetap menutup transaksi saat PPOB mati');
      assert.strictEqual(t!.refunded, true, 'saldo harus dikembalikan');
      const c = await prisma.customer.findUnique({ where: { id: customerId } });
      assert.strictEqual(Number(c!.balance), 10800, 'saldo refund harus masuk');

      // Cek status & riwayat juga tidak boleh ikut diblokir.
      assert.strictEqual((await getStatus(user.id, refId)).status, 'FAILED', 'cek status harus tetap jalan');
      assert.ok((await listTransactions(user.id)).some((x) => x.refId === refId), 'riwayat harus tetap terbaca');
    } finally {
      await prisma.user.delete({ where: { id: user.id } }); // cascade ke customer + transaksi
    }

    console.log('OK: ppob_enabled publik tanpa rahasia, gerbang katalog/inquiry/order, webhook & cek status tetap jalan');
  } finally {
    await updateSettings({ ppob_enabled: original }); // pulihkan setelan asli
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
