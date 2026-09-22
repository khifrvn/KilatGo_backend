import { Prisma, VoucherDiscountType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export const VOUCHER_SERVICES = ['RIDE', 'CAR', 'SEND', 'FOOD'] as const;
type Svc = (typeof VOUCHER_SERVICES)[number];

type Voucher = Prisma.VoucherGetPayload<{}>;

function parseServices(json: string): string[] {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
}

// Basis "belanja" utk cek min. transaksi: FOOD = subtotal makanan, lainnya = ongkir/tarif.
function spendBase(serviceType: string, deliveryFare: number, itemsTotal: number): number {
  return serviceType === 'FOOD' ? itemsTotal : deliveryFare;
}

// Potongan yang dihasilkan voucher (tak pernah melebihi total barang+ongkir).
export function computeDiscount(v: Voucher, serviceType: string, deliveryFare: number, itemsTotal: number): number {
  const value = Number(v.value);
  const base = spendBase(serviceType, deliveryFare, itemsTotal);
  let d = 0;
  if (v.discountType === 'PERCENT') {
    d = Math.round((base * value) / 100);
    if (v.maxDiscount != null) d = Math.min(d, Number(v.maxDiscount));
  } else if (v.discountType === 'FIXED') {
    d = value;
  } else { // FREE_ONGKIR
    d = value > 0 ? Math.min(deliveryFare, value) : deliveryFare;
  }
  return Math.max(0, Math.min(d, deliveryFare + itemsTotal));
}

// Alasan tidak memenuhi syarat (null = valid). Tidak cek kuota/limit di sini (butuh query terpisah).
function baseEligibility(v: Voucher, serviceType: string, deliveryFare: number, itemsTotal: number, now: Date): string | null {
  if (!v.isActive) return 'Voucher tidak aktif';
  if (now < v.startAt) return 'Voucher belum berlaku';
  if (now > v.endAt) return 'Voucher sudah kedaluwarsa';
  if (!parseServices(v.services).includes(serviceType)) return 'Voucher tidak berlaku untuk layanan ini';
  if (spendBase(serviceType, deliveryFare, itemsTotal) < Number(v.minSpend)) {
    return `Minimal transaksi Rp${Number(v.minSpend).toLocaleString('id-ID')}`;
  }
  return null;
}

async function isNewCustomer(customerId: string): Promise<boolean> {
  const done = await prisma.order.count({ where: { customerId, status: 'COMPLETED' } });
  return done === 0;
}

// Voucher yang bisa dipakai user ini untuk transaksi saat ini (masing-masing dengan potongannya).
export async function listApplicable(userId: string, serviceType: string, deliveryFare: number, itemsTotal: number) {
  const customer = await prisma.customer.findUnique({ where: { userId } });
  if (!customer) return [];
  const now = new Date();
  const vouchers = await prisma.voucher.findMany({ where: { isActive: true, startAt: { lte: now }, endAt: { gte: now } }, orderBy: { endAt: 'asc' } });
  const newCust = vouchers.some((v) => v.newUserOnly) ? await isNewCustomer(customer.id) : true;

  const out: any[] = [];
  for (const v of vouchers) {
    if (baseEligibility(v, serviceType, deliveryFare, itemsTotal, now)) continue;
    if (v.totalQuota != null && v.usedCount >= v.totalQuota) continue;
    if (v.newUserOnly && !newCust) continue;
    const used = await prisma.voucherRedemption.count({ where: { voucherId: v.id, customerId: customer.id } });
    if (used >= v.perUserLimit) continue;
    out.push({
      code: v.code, title: v.title, description: v.description,
      discountType: v.discountType, value: Number(v.value),
      maxDiscount: v.maxDiscount != null ? Number(v.maxDiscount) : null,
      minSpend: Number(v.minSpend), services: parseServices(v.services),
      discount: computeDiscount(v, serviceType, deliveryFare, itemsTotal),
    });
  }
  return out;
}

// Validasi voucher (dipakai order.service saat checkout). Lempar AppError bila tak valid.
export async function validateForOrder(customerId: string, code: string, serviceType: string, deliveryFare: number, itemsTotal: number) {
  const v = await prisma.voucher.findUnique({ where: { code: code.toUpperCase() } });
  if (!v) throw new AppError('Kode voucher tidak ditemukan', 400);
  const now = new Date();
  const reason = baseEligibility(v, serviceType, deliveryFare, itemsTotal, now);
  if (reason) throw new AppError(reason, 400);
  if (v.totalQuota != null && v.usedCount >= v.totalQuota) throw new AppError('Kuota voucher habis', 400);
  if (v.newUserOnly && !(await isNewCustomer(customerId))) throw new AppError('Voucher khusus pengguna baru', 400);
  const used = await prisma.voucherRedemption.count({ where: { voucherId: v.id, customerId } });
  if (used >= v.perUserLimit) throw new AppError('Anda sudah memakai voucher ini', 400);
  return { voucher: v, discount: computeDiscount(v, serviceType, deliveryFare, itemsTotal) };
}

// Catat pemakaian + kurangi kuota (dipanggil DALAM transaksi createOrder).
export async function redeemInTx(tx: Prisma.TransactionClient, voucherId: string, customerId: string, orderId: string | null, amount: number, serviceType: string) {
  await tx.voucher.update({ where: { id: voucherId }, data: { usedCount: { increment: 1 } } });
  await tx.voucherRedemption.create({ data: { voucherId, customerId, orderId, amount, serviceType } });
}

// ===== Admin CRUD =====
function normServices(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((s): s is string => typeof s === 'string' && (VOUCHER_SERVICES as readonly string[]).includes(s));
}
function toAdmin(v: Voucher) {
  return {
    id: v.id, code: v.code, title: v.title, description: v.description,
    discountType: v.discountType, value: Number(v.value),
    maxDiscount: v.maxDiscount != null ? Number(v.maxDiscount) : null,
    minSpend: Number(v.minSpend), services: parseServices(v.services),
    startAt: v.startAt, endAt: v.endAt,
    totalQuota: v.totalQuota, usedCount: v.usedCount, perUserLimit: v.perUserLimit,
    newUserOnly: v.newUserOnly, isActive: v.isActive, createdAt: v.createdAt,
  };
}

export async function listAll() {
  return (await prisma.voucher.findMany({ orderBy: { createdAt: 'desc' } })).map(toAdmin);
}

type VoucherInput = {
  code: string; title: string; description?: string;
  discountType: string; value: number; maxDiscount?: number | null; minSpend?: number;
  services: string[]; startAt: string; endAt: string;
  totalQuota?: number | null; perUserLimit?: number; newUserOnly?: boolean; isActive?: boolean;
};

function validateInput(input: VoucherInput, forCreate: boolean) {
  if (forCreate && !input.code?.trim()) throw new AppError('Kode wajib diisi', 400);
  if (!input.title?.trim()) throw new AppError('Judul wajib diisi', 400);
  if (!['PERCENT', 'FIXED', 'FREE_ONGKIR'].includes(input.discountType)) throw new AppError('Jenis potongan tidak valid', 400);
  if (!normServices(input.services).length) throw new AppError('Pilih minimal satu layanan', 400);
  if (!input.startAt || !input.endAt) throw new AppError('Periode berlaku wajib diisi', 400);
  if (new Date(input.endAt) < new Date(input.startAt)) throw new AppError('Tanggal selesai sebelum mulai', 400);
  if (input.discountType === 'PERCENT' && (Number(input.value) <= 0 || Number(input.value) > 100)) throw new AppError('Persen harus 1-100', 400);
}

function dataFrom(input: VoucherInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    discountType: input.discountType as VoucherDiscountType,
    value: Number(input.value) || 0,
    maxDiscount: input.maxDiscount != null && input.maxDiscount !== ('' as any) ? Number(input.maxDiscount) : null,
    minSpend: Number(input.minSpend) || 0,
    services: JSON.stringify(normServices(input.services)),
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
    totalQuota: input.totalQuota != null && input.totalQuota !== ('' as any) ? Number(input.totalQuota) : null,
    perUserLimit: Number(input.perUserLimit) || 1,
    newUserOnly: !!input.newUserOnly,
    isActive: input.isActive ?? true,
  };
}

export async function create(input: VoucherInput) {
  validateInput(input, true);
  const code = input.code.trim().toUpperCase();
  const dup = await prisma.voucher.findUnique({ where: { code } });
  if (dup) throw new AppError('Kode voucher sudah dipakai', 409);
  const v = await prisma.voucher.create({ data: { code, ...dataFrom(input) } });
  return toAdmin(v);
}

export async function update(id: string, input: VoucherInput) {
  validateInput(input, false);
  const exists = await prisma.voucher.findUnique({ where: { id } });
  if (!exists) throw new AppError('Voucher tidak ditemukan', 404);
  const v = await prisma.voucher.update({ where: { id }, data: dataFrom(input) });
  return toAdmin(v);
}

export async function remove(id: string) {
  await prisma.voucher.delete({ where: { id } });
  return { ok: true };
}
