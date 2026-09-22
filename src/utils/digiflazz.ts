import crypto from 'crypto';
import { getDigiflazzConfig } from '../services/settings.service';

// Client Digiflazz (vendor PPOB). Semua request POST JSON ke /v1/*, auth pakai
// sign = md5(username + apiKey + <suffix>): "pricelist" | "depo" | ref_id transaksi.
const BASE = 'https://api.digiflazz.com/v1';

export interface DigiProduct {
  product_name: string;
  category: string;
  brand: string;
  type: string;
  seller_name: string;
  price: number;
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  unlimited_stock: boolean;
  stock: number;
  multi: boolean;
  start_cut_off: string;
  end_cut_off: string;
  desc: string;
}

// Hasil transaksi. status: Sukses | Pending | Gagal.
export interface DigiTrx {
  ref_id: string;
  customer_no: string;
  buyer_sku_code: string;
  message: string;
  status: string;
  rc: string;
  sn?: string;
  price?: number;
  buyer_last_saldo?: number;
}

const md5 = (s: string) => crypto.createHash('md5').update(s).digest('hex');

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { data?: T };
  if (json?.data === undefined) throw new Error(`Digiflazz ${path}: respons tidak dikenali`);
  return json.data;
}

export async function priceList(): Promise<DigiProduct[]> {
  const cfg = await getDigiflazzConfig();
  const data = await call<DigiProduct[] | { rc?: string; message?: string }>('/price-list', {
    cmd: 'prepaid',
    username: cfg.username,
    sign: md5(cfg.username + cfg.apiKey + 'pricelist'),
  });
  // Error dikembalikan sebagai object (bukan array) di dalam `data`.
  if (!Array.isArray(data)) throw new Error(`Digiflazz price-list: ${(data as any)?.message || 'gagal'}`);
  return data;
}

// Beli produk prepaid. ref_id yang sama = cek status transaksi lama (idempotent di sisi vendor).
export async function transaction(opts: {
  sku: string;
  customerNo: string;
  refId: string;
  maxPrice?: number;
}): Promise<DigiTrx> {
  const cfg = await getDigiflazzConfig();
  return call<DigiTrx>('/transaction', {
    username: cfg.username,
    buyer_sku_code: opts.sku,
    customer_no: opts.customerNo,
    ref_id: opts.refId,
    sign: md5(cfg.username + cfg.apiKey + opts.refId),
    ...(cfg.testing ? { testing: true } : {}),
    ...(opts.maxPrice ? { max_price: opts.maxPrice } : {}),
  });
}

// Hasil cek ID pelanggan PLN. rc "00" = ditemukan.
export interface DigiPlnCustomer {
  status: string;
  rc: string;
  message: string;
  customer_no: string;
  meter_no: string;
  subscriber_id: string;
  name: string;
  segment_power: string;
}

/// Cek nomor meter PLN sebelum token dibeli — tanpa ini, salah ketik satu digit
/// mengirim token ke meteran orang lain dan vendor tetap membalas Sukses,
/// sehingga refund otomatis tidak pernah jalan.
export async function inquiryPln(customerNo: string): Promise<DigiPlnCustomer> {
  const cfg = await getDigiflazzConfig();
  return call<DigiPlnCustomer>('/inquiry-pln', {
    username: cfg.username,
    customer_no: customerNo,
    sign: md5(cfg.username + cfg.apiKey + customerNo),
  });
}

// ===== Pascabayar (tagihan) =====
// Produk tagihan tidak punya harga tetap & tidak punya stok: nominalnya baru
// diketahui setelah inquiry ke tagihan pelanggan, jadi katalognya terpisah.
export interface DigiPascaProduct {
  product_name: string;
  category: string;
  brand: string;
  seller_name: string;
  admin: number;
  commission: number;
  buyer_sku_code: string;
  buyer_product_status: boolean;
  seller_product_status: boolean;
  desc: string;
}

export async function priceListPasca(): Promise<DigiPascaProduct[]> {
  const cfg = await getDigiflazzConfig();
  const data = await call<DigiPascaProduct[] | { rc?: string; message?: string }>('/price-list', {
    cmd: 'pasca',
    username: cfg.username,
    sign: md5(cfg.username + cfg.apiKey + 'pricelist'),
  });
  if (!Array.isArray(data)) throw new Error(`Digiflazz price-list pasca: ${(data as any)?.message || 'gagal'}`);
  return data;
}

// Hasil inq/pay/status pascabayar. `price` = yang dipotong dari deposit kita
// (sudah dikurangi komisi), `selling_price` = tagihan + admin (harga ke pelanggan).
export interface DigiPascaTrx extends DigiTrx {
  customer_name?: string;
  admin?: number;
  selling_price?: number;
  desc?: unknown;
}

/// inq-pasca (cek tagihan) | pay-pasca (bayar) | status-pasca (cek ulang).
/// pay-pasca WAJIB memakai ref_id yang sama dengan inquiry-nya — kalau berbeda,
/// vendor menolak karena tidak ada tagihan yang tercatat untuk ref_id itu.
export async function pasca(
  command: 'inq-pasca' | 'pay-pasca' | 'status-pasca',
  opts: { sku: string; customerNo: string; refId: string },
): Promise<DigiPascaTrx> {
  const cfg = await getDigiflazzConfig();
  return call<DigiPascaTrx>('/transaction', {
    commands: command,
    username: cfg.username,
    buyer_sku_code: opts.sku,
    customer_no: opts.customerNo,
    ref_id: opts.refId,
    sign: md5(cfg.username + cfg.apiKey + opts.refId),
    ...(cfg.testing ? { testing: true } : {}),
  });
}

export async function cekSaldo(): Promise<number> {
  const cfg = await getDigiflazzConfig();
  const data = await call<{ deposit: number }>('/cek-saldo', {
    cmd: 'deposit',
    username: cfg.username,
    sign: md5(cfg.username + cfg.apiKey + 'depo'),
  });
  return Number(data.deposit) || 0;
}

// Webhook Digiflazz: header X-Hub-Signature = "sha1=" + hmac_sha1(rawBody, secret).
export function verifyWebhook(rawBody: Buffer | string, header: string, secret: string): boolean {
  if (!secret) return false;
  const expected = 'sha1=' + crypto.createHmac('sha1', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
