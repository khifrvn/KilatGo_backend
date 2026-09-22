import { Prisma, WalletKind } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as digiflazz from '../utils/digiflazz';
import type { DigiPascaProduct, DigiPascaTrx, DigiProduct, DigiTrx } from '../utils/digiflazz';
import * as notificationService from './notification.service';
import * as settingsService from './settings.service';

// ===== Katalog =====
// Daftar harga vendor jarang berubah → cache di memori 10 menit. ponytail: cache proses
// tunggal, cukup untuk 1 instance; pindah ke Redis kalau backend di-scale horizontal.
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; items: DigiProduct[] } | null = null;

async function getCatalog(force = false): Promise<DigiProduct[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;
  const items = await digiflazz.priceList();
  cache = { at: Date.now(), items };
  return items;
}

// Harga jual = harga vendor + markup persen + markup flat, dibulatkan ke atas per Rp100.
export function markup(cost: number, s: Record<string, string>): number {
  const pct = parseFloat(s.ppob_markup_percent || '0') || 0;
  const flat = parseFloat(s.ppob_markup_flat || '0') || 0;
  return Math.ceil((cost * (1 + pct / 100) + flat) / 100) * 100;
}

const available = (p: DigiProduct) =>
  p.buyer_product_status && p.seller_product_status && (p.unlimited_stock || Number(p.stock) > 0);

// Gerbang fitur PPOB. SENGAJA hanya dipakai katalog/inquiry/order.
// JANGAN pasang di handleWebhook, getStatus, listTransactions, atau sweeper
// PENDING: transaksi yang sudah telanjur jalan harus tetap bisa ditutup
// (sukses/gagal/refund) walau admin mematikan PPOB di tengah jalan.
async function requireEnabled(s: Record<string, string>) {
  if (s.ppob_enabled !== '1') throw new AppError('Fitur PPOB belum tersedia', 503);
  const cfg = await settingsService.getDigiflazzConfig();
  if (!cfg.username || !cfg.apiKey) throw new AppError('PPOB belum dikonfigurasi', 503);
}

// Daftar SKU yang dipilih admin untuk dijual. Kosong = jual semua yang tersedia,
// supaya fitur tetap jalan sebelum admin sempat menyeleksi.
function activeSkus(s: Record<string, string>): Set<string> {
  try {
    const arr = JSON.parse(s.ppob_active_skus || '[]');
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export async function getActiveSkus() {
  const s = await settingsService.getSettings();
  return [...activeSkus(s)];
}

export async function setActiveSkus(skus: unknown) {
  const clean = Array.isArray(skus) ? [...new Set(skus.map(String).filter(Boolean))] : [];
  await settingsService.updateSettings({ ppob_active_skus: JSON.stringify(clean) });
  return { count: clean.length };
}

// Katalog untuk app: tersedia di vendor + dipilih admin + harga jual.
export async function listProducts(filter: { category?: string; brand?: string } = {}) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const cat = filter.category?.trim().toLowerCase();
  const brand = filter.brand?.trim().toLowerCase();
  const picked = activeSkus(s);
  return (await getCatalog())
    .filter(available)
    .filter((p) => picked.size === 0 || picked.has(p.buyer_sku_code))
    .filter((p) => (!cat || p.category.toLowerCase() === cat) && (!brand || p.brand.toLowerCase() === brand))
    .map((p) => ({
      sku: p.buyer_sku_code,
      name: p.product_name,
      category: p.category,
      brand: p.brand,
      type: p.type,
      price: markup(Number(p.price), s),
      desc: p.desc,
      startCutOff: p.start_cut_off,
      endCutOff: p.end_cut_off,
    }));
}

// Daftar kategori + brand (untuk tab/grid di app).
export async function listCategories() {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const picked = activeSkus(s);
  const map = new Map<string, Set<string>>();
  for (const p of (await getCatalog())
    .filter(available)
    .filter((p) => picked.size === 0 || picked.has(p.buyer_sku_code))) {
    if (!map.has(p.category)) map.set(p.category, new Set());
    map.get(p.category)!.add(p.brand);
  }
  return [...map].map(([category, brands]) => ({ category, brands: [...brands].sort() }));
}

// ===== Pemilik transaksi =====
// PPOB dipakai pelanggan (saldo KilatGo) dan driver (Dompet Pendapatan). Semua
// perbedaan dompet dikurung di sini supaya buy/refund/riwayat tetap satu jalur.
type Owner =
  | { kind: 'CUSTOMER'; id: string; userId: string }
  | { kind: 'MERCHANT'; id: string; userId: string }
  | { kind: 'DRIVER'; id: string; userId: string; wallet: WalletKind };

const ownerWhere = (o: Owner) =>
  o.kind === 'CUSTOMER' ? { customerId: o.id } : o.kind === 'MERCHANT' ? { merchantId: o.id } : { driverId: o.id };

// Kolom saldo per dompet driver — dipakai debit & refund supaya tidak ada string
// dompet yang tersebar di beberapa tempat.
const WALLET_FIELD = {
  [WalletKind.EARNINGS]: 'earningsBalance',
  [WalletKind.CREDIT]: 'creditBalance',
} as const;

/// Cari pemilik dari userId. Driver dikenali lebih dulu karena satu user tidak
/// pernah menjadi keduanya; kalau ternyata bukan dua-duanya, tolak.
/// [wallet] hanya berlaku untuk driver; default Dompet Pendapatan.
export async function resolveOwner(userId: string, wallet?: string): Promise<Owner> {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
  if (driver) return { kind: 'DRIVER', id: driver.id, userId, wallet: parseWallet(wallet) };
  const merchant = await prisma.merchant.findUnique({ where: { userId }, select: { id: true } });
  if (merchant) return { kind: 'MERCHANT', id: merchant.id, userId };
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (customer) return { kind: 'CUSTOMER', id: customer.id, userId };
  throw new AppError('Akun tidak berhak memakai layanan ini', 403);
}

/// Dompet dari request. Nilai asing ditolak, bukan diam-diam jatuh ke default —
/// salah dompet berarti memotong uang yang bukan diniatkan pemakainya.
function parseWallet(v?: string): WalletKind {
  if (v == null || v === '') return WalletKind.EARNINGS;
  if (v === WalletKind.EARNINGS || v === WalletKind.CREDIT) return v;
  throw new AppError('Dompet tidak dikenali', 400);
}

/// Potong saldo dengan guard atomik `saldo >= amount`. Mengembalikan false kalau
/// saldo tidak cukup — pemanggil yang memutuskan pesan errornya.
async function debit(tx: Prisma.TransactionClient, o: Owner, amount: number): Promise<boolean> {
  if (o.kind === 'CUSTOMER') {
    const paid = await tx.customer.updateMany({
      where: { id: o.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    return paid.count > 0;
  }
  if (o.kind === 'MERCHANT') {
    const paid = await tx.merchant.updateMany({
      where: { id: o.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    return paid.count > 0;
  }
  const field = WALLET_FIELD[o.wallet];
  const paid = await tx.driver.updateMany({
    where: { id: o.id, [field]: { gte: amount } },
    data: { [field]: { decrement: amount } },
  });
  return paid.count > 0;
}

/// Kembalikan dana ke dompet yang sama dengan saat pembelian.
async function refund(o: Owner, amount: number, note: string) {
  if (o.kind === 'CUSTOMER') {
    await prisma.customer.update({ where: { id: o.id }, data: { balance: { increment: amount } } });
    return;
  }
  if (o.kind === 'MERCHANT') {
    await prisma.merchant.update({ where: { id: o.id }, data: { balance: { increment: amount } } });
    return;
  }
  const field = WALLET_FIELD[o.wallet];
  const drv = await prisma.driver.update({
    where: { id: o.id },
    data: { [field]: { increment: amount } },
    select: { earningsBalance: true, creditBalance: true },
  });
  await ledger(o, amount, Number(drv[field]), note);
}

/// Baris ledger dompet driver. Pelanggan tidak punya ledger setara — riwayat
/// PPOB-nya sudah tercatat di tabel ppob_transactions.
async function ledger(o: Extract<Owner, { kind: 'DRIVER' }>, amount: number, balanceAfter: number, note: string, ref?: string) {
  await prisma.walletTransaction.create({
    data: { driverId: o.id, wallet: o.wallet, type: 'PPOB', amount, balanceAfter, note, ref },
  });
}

/// Pemilik dari baris transaksi (untuk refund & notifikasi). null kalau barisnya
/// yatim — mungkin akunnya sudah dihapus; jangan sampai menggagalkan callback.
async function ownerOf(trx: {
  customerId: string | null;
  driverId: string | null;
  merchantId: string | null;
  wallet: WalletKind | null;
}): Promise<Owner | null> {
  if (trx.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: trx.customerId }, select: { userId: true } });
    return c ? { kind: 'CUSTOMER', id: trx.customerId, userId: c.userId } : null;
  }
  if (trx.merchantId) {
    const m = await prisma.merchant.findUnique({ where: { id: trx.merchantId }, select: { userId: true } });
    return m ? { kind: 'MERCHANT', id: trx.merchantId, userId: m.userId } : null;
  }
  if (trx.driverId) {
    const d = await prisma.driver.findUnique({ where: { id: trx.driverId }, select: { userId: true } });
    // Baris lama sebelum kolom `wallet` ada hanya memakai Dompet Pendapatan.
    return d
      ? { kind: 'DRIVER', id: trx.driverId, userId: d.userId, wallet: trx.wallet ?? WalletKind.EARNINGS }
      : null;
  }
  return null;
}

/// Dompet yang bisa dipakai membayar PPOB. App menampilkan pilihannya kalau
/// lebih dari satu — pelanggan selalu satu, driver punya dua.
export async function balanceOf(userId: string) {
  const o = await resolveOwner(userId);
  if (o.kind === 'CUSTOMER') {
    const c = await prisma.customer.findUnique({ where: { id: o.id }, select: { balance: true } });
    const balance = Number(c?.balance ?? 0);
    return { balance, wallets: [{ kind: 'CUSTOMER', label: 'Saldo KilatGo', balance }] };
  }
  if (o.kind === 'MERCHANT') {
    const m = await prisma.merchant.findUnique({ where: { id: o.id }, select: { balance: true } });
    const balance = Number(m?.balance ?? 0);
    return { balance, wallets: [{ kind: 'MERCHANT', label: 'Saldo Mitra', balance }] };
  }
  const d = await prisma.driver.findUnique({
    where: { id: o.id },
    select: { earningsBalance: true, creditBalance: true },
  });
  const earnings = Number(d?.earningsBalance ?? 0);
  return {
    // `balance` = dompet default, dipakai app lama yang belum paham daftar dompet.
    balance: earnings,
    wallets: [
      { kind: WalletKind.EARNINGS, label: 'Dompet Pendapatan', balance: earnings },
      { kind: WalletKind.CREDIT, label: 'Dompet Kredit', balance: Number(d?.creditBalance ?? 0) },
    ],
  };
}

// ===== Transaksi =====
const shape = (t: {
  refId: string; sku: string; productName: string; customerNo: string; category: string | null;
  brand: string | null; sellPrice: any; status: string; rc: string | null; message: string | null;
  sn: string | null; refunded: boolean; createdAt: Date; wallet?: WalletKind | null;
}) => ({
  refId: t.refId, sku: t.sku, productName: t.productName, customerNo: t.customerNo,
  category: t.category, brand: t.brand, price: Number(t.sellPrice), status: t.status,
  rc: t.rc, message: t.message, sn: t.sn, refunded: t.refunded, createdAt: t.createdAt,
  wallet: t.wallet ?? null,
});

// Satu-satunya tempat hasil vendor diterapkan (dipakai buy, cek status & webhook).
// Idempotent: flip PENDING→final secara atomik; refund hanya oleh yang berhasil flip.
export async function applyResult(refId: string, r: DigiTrx) {
  const status = r.status === 'Sukses' ? 'SUCCESS' : r.status === 'Gagal' ? 'FAILED' : 'PENDING';
  const trx = await prisma.ppobTransaction.findUnique({ where: { refId } });
  if (!trx) return null;

  if (status === 'PENDING') {
    await prisma.ppobTransaction.updateMany({
      where: { id: trx.id, status: 'PENDING' },
      data: { rc: r.rc, message: r.message },
    });
    return { ...trx, rc: r.rc, message: r.message };
  }

  const flipped = await prisma.ppobTransaction.updateMany({
    where: { id: trx.id, status: 'PENDING' },
    data: { status, rc: r.rc, message: r.message, sn: r.sn ?? null, refunded: status === 'FAILED' },
  });
  if (flipped.count === 0) return trx; // sudah final dari callback lain

  const owner = await ownerOf(trx);

  if (status === 'FAILED' && owner) {
    await refund(owner, Number(trx.sellPrice), `Refund ${trx.productName} (${trx.refId})`);
  }

  if (owner) {
    await notificationService.createNotification({
      userId: owner.userId,
      title: status === 'SUCCESS' ? 'Pembelian berhasil' : 'Pembelian gagal',
      body:
        status === 'SUCCESS'
          ? `${trx.productName} untuk ${trx.customerNo} berhasil.${r.sn ? ` SN/Token: ${r.sn}` : ''}`
          : `${trx.productName} untuk ${trx.customerNo} gagal (${r.message}). Saldo dikembalikan.`,
      type: 'PPOB',
    });
  }
  return { ...trx, status, rc: r.rc, message: r.message, sn: r.sn ?? null, refunded: status === 'FAILED' };
}

// Cek nomor meter PLN → nama & daya pelanggan, dipakai app untuk konfirmasi
// sebelum bayar. Token yang terlanjur masuk ke meteran orang lain tidak bisa
// ditarik kembali, jadi ini satu-satunya pengaman salah ketik.
export async function inquiryPln(customerNo: string) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);

  const no = String(customerNo || '').replace(/[\s-]/g, '');
  if (!/^\d{6,20}$/.test(no)) throw new AppError('Nomor meter tidak valid', 400);

  let r: Awaited<ReturnType<typeof digiflazz.inquiryPln>>;
  try {
    r = await digiflazz.inquiryPln(no);
  } catch (e) {
    console.error('digiflazz inquiry-pln error', e);
    throw new AppError('Gagal memeriksa nomor meter. Coba lagi.', 502);
  }
  // Vendor memakai rc "00" untuk ditemukan; selain itu nomornya tidak dikenali.
  if (r.rc !== '00') throw new AppError(r.message || 'Nomor meter tidak ditemukan', 404);

  return {
    customerNo: r.customer_no,
    meterNo: r.meter_no,
    subscriberId: r.subscriber_id,
    name: r.name,
    segmentPower: r.segment_power,
  };
}

// ===== Pascabayar (tagihan) =====
// Katalog & alur terpisah dari prepaid: harga tagihan baru diketahui setelah
// cek ke vendor, jadi tidak bisa lewat listProducts/markup yang sama.
let pascaCache: { at: number; items: DigiPascaProduct[] } | null = null;

async function getPascaCatalog(): Promise<DigiPascaProduct[]> {
  if (pascaCache && Date.now() - pascaCache.at < CACHE_TTL_MS) return pascaCache.items;
  const items = await digiflazz.priceListPasca();
  pascaCache = { at: Date.now(), items };
  return items;
}

// Produk tagihan tidak punya stok — hanya status buyer/seller yang menentukan.
const pascaAvailable = (p: DigiPascaProduct) => p.buyer_product_status && p.seller_product_status;

/// ponytail: filter SKU pilihan admin sengaja tidak dipakai di sini — isinya SKU
/// prepaid, kalau ikut difilter semua produk tagihan hilang. Tambahkan daftar
/// terpisah kalau admin memang perlu menyeleksi tagihan.
async function pascaProduct(sku: string): Promise<DigiPascaProduct> {
  const p = (await getPascaCatalog()).find((x) => x.buyer_sku_code === sku);
  if (!p || !pascaAvailable(p)) throw new AppError('Produk tidak tersedia', 404);
  return p;
}

export async function listPascaProducts(filter: { category?: string; brand?: string } = {}) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const cat = filter.category?.trim().toLowerCase();
  const brand = filter.brand?.trim().toLowerCase();
  return (await getPascaCatalog())
    .filter(pascaAvailable)
    .filter((p) => (!cat || p.category.toLowerCase() === cat) && (!brand || p.brand.toLowerCase() === brand))
    .map((p) => ({
      sku: p.buyer_sku_code,
      name: p.product_name,
      category: p.category,
      brand: p.brand,
      admin: Number(p.admin) || 0,
      desc: p.desc,
    }));
}

export async function listPascaCategories() {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const map = new Map<string, Set<string>>();
  for (const p of (await getPascaCatalog()).filter(pascaAvailable)) {
    if (!map.has(p.category)) map.set(p.category, new Set());
    map.get(p.category)!.add(p.brand);
  }
  return [...map].map(([category, brands]) => ({ category, brands: [...brands].sort() }));
}

/// ID pelanggan tagihan bisa memuat huruf (mis. sebagian multifinance), jadi
/// lebih longgar dari nomor prepaid — tapi tetap dibatasi alfanumerik supaya
/// tidak ada karakter aneh yang lolos ke `customer_no` milik vendor.
function pascaCustomerNo(v: string): string {
  const no = String(v || '').replace(/[\s-]/g, '');
  if (!/^[A-Za-z0-9]{4,25}$/.test(no)) throw new AppError('Nomor / ID pelanggan tidak valid', 400);
  return no;
}

/// Harga dari hasil inquiry. `price` = yang dipotong dari deposit kita,
/// `selling_price` = tagihan + admin. Selisihnya komisi vendor = margin kita,
/// jadi tagihan TIDAK dikenai markup persen (5% dari tagihan listrik 500rb
/// bukan biaya admin, itu perampokan).
export function pascaPricing(r: { price?: number; selling_price?: number }) {
  const cost = Number(r.price ?? 0);
  // Jual tidak pernah di bawah modal, walau vendor mengirim angka yang aneh.
  const sell = Math.max(Number(r.selling_price ?? 0), cost);
  return { cost, sell };
}

const newRefId = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;

/// Transaksi pascabayar dicek ulang dengan perintah berbeda dari prepaid.
/// Ditandai lewat awalan ref_id supaya tidak perlu kolom baru di DB.
const isPasca = (refId: string) => refId.startsWith('PASCA');

/// Tanya vendor status transaksi (prepaid: kirim ulang ref_id, pasca: status-pasca).
async function askVendor(t: { sku: string; customerNo: string; refId: string }): Promise<DigiTrx> {
  return isPasca(t.refId)
    ? digiflazz.pasca('status-pasca', { sku: t.sku, customerNo: t.customerNo, refId: t.refId })
    : digiflazz.transaction({ sku: t.sku, customerNo: t.customerNo, refId: t.refId });
}

const shapeInquiry = (p: DigiPascaProduct, r: DigiPascaTrx) => {
  const { sell } = pascaPricing(r);
  const admin = Number(r.admin ?? p.admin) || 0;
  return {
    sku: p.buyer_sku_code,
    productName: p.product_name,
    category: p.category,
    brand: p.brand,
    customerNo: r.customer_no,
    customerName: r.customer_name ?? '',
    bill: Math.max(sell - admin, 0), // tagihan murni, tanpa biaya admin
    admin,
    total: sell, // yang dibayar pelanggan
    detail: r.desc ?? null, // rincian lembar tagihan dari vendor (bentuknya beda tiap produk)
  };
};

/// Cek tagihan → nama pelanggan & nominal. Read-only: tidak memotong saldo dan
/// tidak menyimpan apa pun, karena harga dipastikan ulang saat membayar.
export async function inquiryPasca(sku: string, customerNo: string) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const no = pascaCustomerNo(customerNo);
  const product = await pascaProduct(sku);

  let r: DigiPascaTrx;
  try {
    r = await digiflazz.pasca('inq-pasca', { sku, customerNo: no, refId: newRefId('INQ') });
  } catch (e) {
    console.error('digiflazz inq-pasca error', e);
    throw new AppError('Gagal memeriksa tagihan. Coba lagi.', 502);
  }
  if (r.rc !== '00') throw new AppError(r.message || 'Tagihan tidak ditemukan', 404);
  return shapeInquiry(product, r);
}

/// Bayar tagihan. Inquiry diulang di sini dengan ref_id yang akan dipakai
/// membayar: (1) pay-pasca mensyaratkan ref_id yang sama dengan inquiry-nya,
/// (2) nominal diambil dari vendor, bukan dari app — app tidak boleh menentukan
/// berapa saldo yang dipotong. [maxTotal] = total yang disetujui pengguna di
/// layar konfirmasi; kalau tagihan berubah, transaksi ditolak, bukan diam-diam
/// memotong lebih banyak.
export async function payPasca(
  userId: string,
  sku: string,
  customerNo: string,
  maxTotal?: number,
  wallet?: string,
) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);
  const no = pascaCustomerNo(customerNo);
  const product = await pascaProduct(sku);
  const owner = await resolveOwner(userId, wallet);
  const refId = newRefId('PASCA');

  let inq: DigiPascaTrx;
  try {
    inq = await digiflazz.pasca('inq-pasca', { sku, customerNo: no, refId });
  } catch (e) {
    console.error('digiflazz inq-pasca (pay) error', e);
    throw new AppError('Gagal memeriksa tagihan. Coba lagi.', 502);
  }
  if (inq.rc !== '00') throw new AppError(inq.message || 'Tagihan tidak ditemukan', 404);

  const { cost, sell } = pascaPricing(inq);
  if (!(sell > 0)) throw new AppError('Nominal tagihan tidak terbaca. Coba lagi.', 502);
  if (maxTotal != null && sell > maxTotal) {
    throw new AppError('Nominal tagihan berubah. Cek ulang tagihannya sebelum membayar.', 409);
  }

  const trx = await prisma.$transaction(async (tx) => {
    if (!(await debit(tx, owner, sell))) throw new AppError('Saldo tidak cukup', 400);
    return tx.ppobTransaction.create({
      data: {
        ...ownerWhere(owner), wallet: owner.kind === 'DRIVER' ? owner.wallet : null,
        refId, sku, productName: product.product_name,
        category: product.category, brand: product.brand, customerNo: no,
        costPrice: cost, sellPrice: sell, status: 'PENDING',
      },
    });
  });

  if (owner.kind === 'DRIVER') {
    const drv = await prisma.driver.findUnique({
      where: { id: owner.id },
      select: { earningsBalance: true, creditBalance: true },
    });
    const after = Number(drv?.[WALLET_FIELD[owner.wallet]] ?? 0);
    await ledger(owner, -sell, after, `${product.product_name} untuk ${no}`, refId);
  }

  let result: DigiTrx;
  try {
    result = await digiflazz.pasca('pay-pasca', { sku, customerNo: no, refId });
  } catch (e) {
    // Vendor tak terjangkau → biarkan PENDING, sweeper yang menentukan nasibnya.
    console.error('digiflazz pay-pasca error', e);
    return shape(trx);
  }

  const updated = await applyResult(refId, result);
  return shape({ ...trx, ...(updated as any) });
}

// Pemisah user ID & zone yang boleh dipakai. Dibatasi supaya setting yang salah
// isi tidak bisa menyelundupkan karakter aneh ke `customer_no` milik vendor.
const GAME_ID_SEPARATORS = ['', '.', '|', ':', '-', ' '];

/// Rakit `customer_no` final. Produk game butuh user ID + zone; formatnya
/// ditentukan vendor, jadi perekatnya diambil dari setting (bukan dari app)
/// agar bisa dikoreksi tanpa rilis ulang.
export function buildCustomerNo(customerNo: string, zoneId: string | undefined, s: Record<string, string>): string {
  const id = String(customerNo || '').replace(/[\s-]/g, '');
  if (!/^\d{4,20}$/.test(id)) throw new AppError('Nomor pelanggan tidak valid', 400);

  const zone = String(zoneId ?? '').replace(/[\s-]/g, '');
  if (!zone) return id;
  if (!/^\d{1,10}$/.test(zone)) throw new AppError('Zone / Server ID tidak valid', 400);

  const sep = s.ppob_game_id_separator ?? '';
  if (!GAME_ID_SEPARATORS.includes(sep)) {
    throw new AppError('Format ID game belum dikonfigurasi dengan benar', 503);
  }
  return `${id}${sep}${zone}`;
}

// Beli produk PPOB. Saldo dipotong dulu (guard atomik), dikembalikan bila vendor gagal.
export async function buy(userId: string, sku: string, customerNo: string, zoneId?: string, wallet?: string) {
  const s = await settingsService.getSettings();
  await requireEnabled(s);

  const no = buildCustomerNo(customerNo, zoneId, s);

  const product = (await getCatalog()).find((p) => p.buyer_sku_code === sku);
  if (!product || !available(product)) throw new AppError('Produk tidak tersedia', 404);

  const owner = await resolveOwner(userId, wallet);

  const cost = Number(product.price);
  const sell = markup(cost, s);
  const refId = `PPOB${Date.now()}${Math.floor(Math.random() * 1000)}`;

  // Potong saldo + catat transaksi dalam satu transaksi DB. Guard `saldo >= sell`
  // di dalam updateMany mencegah saldo minus saat request ganda.
  const trx = await prisma.$transaction(async (tx) => {
    if (!(await debit(tx, owner, sell))) throw new AppError('Saldo tidak cukup', 400);
    return tx.ppobTransaction.create({
      data: {
        ...ownerWhere(owner), wallet: owner.kind === 'DRIVER' ? owner.wallet : null,
        refId, sku, productName: product.product_name,
        category: product.category, brand: product.brand, customerNo: no,
        costPrice: cost, sellPrice: sell, status: 'PENDING',
      },
    });
  });

  // Ledger driver ditulis setelah transaksi DB supaya kegagalan mencatat riwayat
  // tidak pernah membatalkan pembelian yang sudah sah.
  if (owner.kind === 'DRIVER') {
    const drv = await prisma.driver.findUnique({
      where: { id: owner.id },
      select: { earningsBalance: true, creditBalance: true },
    });
    const after = Number(drv?.[WALLET_FIELD[owner.wallet]] ?? 0);
    await ledger(owner, -sell, after, `${product.product_name} untuk ${no}`, refId);
  }

  let result: DigiTrx;
  try {
    // max_price = harga vendor saat ini; vendor menolak bila harganya sudah naik.
    result = await digiflazz.transaction({ sku, customerNo: no, refId, maxPrice: cost });
  } catch (e) {
    // Vendor tak terjangkau → transaksi belum tentu terbentuk. Biarkan PENDING;
    // sweeper/cek status yang menentukan nasibnya (jangan refund buta di sini).
    console.error('digiflazz transaction error', e);
    return shape(trx);
  }

  const updated = await applyResult(refId, result);
  return shape({ ...trx, ...(updated as any) });
}

export async function getStatus(userId: string, refId: string) {
  const owner = await resolveOwner(userId);
  // Scope ke pemilik: tanpa ini siapa pun bisa mengintip transaksi orang lain.
  const trx = await prisma.ppobTransaction.findFirst({ where: { refId, ...ownerWhere(owner) } });
  if (!trx) throw new AppError('Transaksi tidak ditemukan', 404);
  if (trx.status !== 'PENDING') return shape(trx);

  // Kirim ulang ref_id yang sama = cek status di Digiflazz.
  try {
    const r = await askVendor(trx);
    const updated = await applyResult(refId, r);
    return shape({ ...trx, ...(updated as any) });
  } catch (e) {
    console.error('digiflazz status error', e);
    return shape(trx);
  }
}

export async function listTransactions(userId: string) {
  const owner = await resolveOwner(userId);
  const rows = await prisma.ppobTransaction.findMany({
    where: ownerWhere(owner), orderBy: { createdAt: 'desc' }, take: 50,
  });
  return rows.map(shape);
}

// Webhook Digiflazz (body: { data: {...} }). Signature sudah diverifikasi di route.
export async function handleWebhook(body: any) {
  const d = body?.data;
  if (!d?.ref_id) return;
  await applyResult(String(d.ref_id), d as DigiTrx);
}

// Jaring pengaman kalau webhook tak terkirim: cek ulang transaksi PENDING > 2 menit.
// Tanpa ini saldo pelanggan bisa nyangkut selamanya di transaksi yang sebenarnya gagal.
export function startPpobPendingSweeper(): void {
  const runOnce = async () => {
    try {
      const cfg = await settingsService.getDigiflazzConfig();
      if (!cfg.username || !cfg.apiKey) return; // PPOB belum dikonfigurasi
      const rows = await prisma.ppobTransaction.findMany({
        where: { status: 'PENDING', createdAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
        take: 50,
      });
      for (const t of rows) {
        try {
          const r = await askVendor(t);
          await applyResult(t.refId, r);
        } catch (err) {
          console.error('[ppob-pending] cek gagal', t.refId, err);
        }
      }
      if (rows.length) console.log(`[ppob-pending] cek ulang ${rows.length} transaksi`);
    } catch (err) {
      console.error('[ppob-pending] sweep gagal', err);
    }
  };
  runOnce();
  setInterval(runOnce, 5 * 60 * 1000); // tiap 5 menit
}

// ===== Admin =====
export async function adminListTransactions(status?: string) {
  const rows = await prisma.ppobTransaction.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      customer: { include: { user: { select: { name: true, phone: true } } } },
      driver: { include: { user: { select: { name: true, phone: true } } } },
      merchant: { include: { user: { select: { name: true, phone: true } } } },
    },
  });
  // Pembeli bisa pelanggan, driver, atau mitra — admin perlu tahu yang mana.
  return rows.map((t) => {
    const u = t.customer?.user ?? t.driver?.user ?? t.merchant?.user;
    return {
      ...shape(t),
      cost: Number(t.costPrice),
      buyerType: t.driverId ? 'DRIVER' : t.merchantId ? 'MERCHANT' : 'CUSTOMER',
      customerName: u?.name ?? '-',
      customerPhone: u?.phone ?? '-',
    };
  });
}

// Katalog MENTAH untuk admin: semua produk vendor tanpa filter, lengkap dengan
// alasan kenapa sebuah produk tidak tampil di app (status buyer/seller, stok).
export async function adminCatalog() {
  const s = await settingsService.getSettings();
  const picked = activeSkus(s);
  const items = (await getCatalog()).map((p) => ({
    sku: p.buyer_sku_code,
    name: p.product_name,
    category: p.category,
    brand: p.brand,
    type: p.type,
    seller: p.seller_name,
    cost: Number(p.price),
    price: markup(Number(p.price), s),
    buyerStatus: !!p.buyer_product_status,
    sellerStatus: !!p.seller_product_status,
    unlimitedStock: !!p.unlimited_stock,
    stock: Number(p.stock) || 0,
    available: available(p),
    active: picked.size === 0 || picked.has(p.buyer_sku_code),
    startCutOff: p.start_cut_off,
    endCutOff: p.end_cut_off,
    desc: p.desc,
  }));
  return {
    items,
    total: items.length,
    availableCount: items.filter((i) => i.available).length,
    selectAll: picked.size === 0, // belum pernah diseleksi admin
  };
}

export async function adminVendorBalance() {
  return { deposit: await digiflazz.cekSaldo() };
}

// Paksa refresh cache katalog (dipakai admin setelah ubah produk di Digiflazz).
export async function adminRefreshCatalog() {
  const items = await getCatalog(true);
  return { count: items.length };
}
