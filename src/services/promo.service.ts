import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

const AUDIENCES = ['CUSTOMER', 'DRIVER', 'MERCHANT'];
const PLACEMENTS = ['ALL', 'FOOD', 'SEND', 'RIDE', 'CAR']; // layar tempat promo tampil

function normAudience(a?: string): string {
  const up = String(a ?? '').toUpperCase();
  if (!AUDIENCES.includes(up)) throw new AppError('Audience tidak valid', 400);
  return up;
}

function normPlacement(p?: string): string {
  const up = String(p ?? 'ALL').toUpperCase();
  if (!PLACEMENTS.includes(up)) throw new AppError('Placement tidak valid', 400);
  return up;
}

export interface PromoInput {
  title?: string;
  description?: string;
  audience?: string;
  placement?: string;
  isActive?: boolean;
  image?: string;
  voucherCode?: string; // kaitan ke voucher (opsional; '' = lepas kaitan)
}

// '' → null; selain itu uppercase + validasi voucher ada.
async function normVoucherCode(code?: string): Promise<string | null> {
  const c = String(code ?? '').trim().toUpperCase();
  if (!c) return null;
  const v = await prisma.voucher.findUnique({ where: { code: c }, select: { code: true } });
  if (!v) throw new AppError('Voucher dengan kode itu tidak ditemukan', 400);
  return c;
}

export function listAll() {
  return prisma.promo.findMany({ orderBy: { createdAt: 'desc' } });
}

// Promo aktif untuk audiens (dan opsional layar/placement) tertentu — dipakai app.
// placement 'ALL' selalu ikut tampil di layar mana pun. Banner yang terkait voucher
// disertai ringkasan vouchernya (kode, potongan, periode, kuota, layanan) untuk detail di app.
export async function listForAudience(audience: string, placement?: string) {
  const promos = await prisma.promo.findMany({
    where: {
      audience: normAudience(audience),
      isActive: true,
      ...(placement ? { placement: { in: [normPlacement(placement), 'ALL'] } } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  const codes = [...new Set(promos.map((p) => p.voucherCode).filter((c): c is string => !!c))];
  if (!codes.length) return promos;
  const vouchers = await prisma.voucher.findMany({ where: { code: { in: codes }, isActive: true } });
  const byCode = new Map(vouchers.map((v) => [v.code, v]));
  return promos.map((p) => {
    const v = p.voucherCode ? byCode.get(p.voucherCode) : undefined;
    if (!v) return p;
    let services: string[] = [];
    try { services = JSON.parse(v.services); } catch { /* ignore */ }
    return {
      ...p,
      voucher: {
        code: v.code,
        discountType: v.discountType,
        value: Number(v.value),
        maxDiscount: v.maxDiscount != null ? Number(v.maxDiscount) : null,
        minSpend: Number(v.minSpend),
        services,
        startAt: v.startAt,
        endAt: v.endAt,
        totalQuota: v.totalQuota,
        usedCount: v.usedCount,
        perUserLimit: v.perUserLimit,
      },
    };
  });
}

export async function create(input: PromoInput) {
  if (!input.title) throw new AppError('Judul wajib', 400);
  return prisma.promo.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      audience: normAudience(input.audience),
      placement: normPlacement(input.placement),
      image: input.image ?? null,
      voucherCode: await normVoucherCode(input.voucherCode),
      isActive: input.isActive ?? true,
    },
  });
}

export async function update(id: string, input: PromoInput) {
  const promo = await prisma.promo.findUnique({ where: { id } });
  if (!promo) throw new AppError('Promo tidak ditemukan', 404);
  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.audience !== undefined) data.audience = normAudience(input.audience);
  if (input.placement !== undefined) data.placement = normPlacement(input.placement);
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.image !== undefined) data.image = input.image;
  if (input.voucherCode !== undefined) data.voucherCode = await normVoucherCode(input.voucherCode);
  return prisma.promo.update({ where: { id }, data });
}

export async function remove(id: string) {
  await prisma.promo.delete({ where: { id } });
  return { id, deleted: true };
}
