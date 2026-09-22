import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as settingsService from './settings.service';
import { parsePromoPackages, promoEndsAt, durationLabel, PromoPackage } from '../utils/promoPackages';

// Promosi berbayar mitra: mitra beli paket durasi pakai SALDO mitra, warungnya
// tampil paling atas + berlabel "Promosi" di beranda KilatFood sampai endsAt.
// Paket & harga dikelola admin (Setting `merchant_promo_packages`).

async function merchantOf(userId: string) {
  const m = await prisma.merchant.findUnique({ where: { userId }, select: { id: true, balance: true } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  return m;
}

// Promosi aktif (endsAt terjauh) milik satu mitra; null bila tidak sedang promosi.
async function activePromo(merchantId: string) {
  return prisma.merchantPromotion.findFirst({
    where: { merchantId, endsAt: { gt: new Date() } },
    orderBy: { endsAt: 'desc' },
    select: { id: true, packageName: true, minutes: true, price: true, endsAt: true, createdAt: true },
  });
}

// Untuk daftar warung publik: merchantId → endsAt promosi aktif (satu query).
export async function activePromoEnds(merchantIds: string[]): Promise<Record<string, Date>> {
  if (merchantIds.length === 0) return {};
  const rows = await prisma.merchantPromotion.findMany({
    where: { merchantId: { in: merchantIds }, endsAt: { gt: new Date() } },
    select: { merchantId: true, endsAt: true },
  });
  const out: Record<string, Date> = {};
  for (const r of rows) {
    const cur = out[r.merchantId];
    if (!cur || r.endsAt > cur) out[r.merchantId] = r.endsAt;
  }
  return out;
}

async function packages(): Promise<PromoPackage[]> {
  const s = await settingsService.getSettings();
  return parsePromoPackages(s.merchant_promo_packages);
}

// Layar "Promosikan Jualan kamu": saldo, paket yang dijual admin, status aktif, riwayat.
export async function getPromoInfo(userId: string) {
  const m = await merchantOf(userId);
  const [list, active, history, s] = await Promise.all([
    packages(),
    activePromo(m.id),
    prisma.merchantPromotion.findMany({
      where: { merchantId: m.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, packageName: true, minutes: true, price: true, endsAt: true, createdAt: true },
    }),
    settingsService.getSettings(),
  ]);
  return {
    balance: Number(m.balance),
    minTopup: Math.max(0, Math.round(parseFloat(s.merchant_promo_min_topup || '0') || 0)),
    packages: list.map((p, i) => ({ index: i, ...p, durationLabel: durationLabel(p.minutes) })),
    active: active
      ? { ...active, price: Number(active.price), durationLabel: durationLabel(active.minutes) }
      : null,
    history: history.map((h) => ({ ...h, price: Number(h.price), durationLabel: durationLabel(h.minutes) })),
  };
}

// Beli paket promosi. Saldo dipotong ATOMIK (guard balance >= price) bersama
// pembuatan baris promosi — tak ada saldo minus walau ditekan dua kali.
export async function buyPromo(userId: string, packageIndex: number) {
  const m = await merchantOf(userId);
  const list = await packages();
  const pkg = list[packageIndex];
  if (!pkg) throw new AppError('Paket promosi tidak tersedia', 400);

  const now = new Date();
  const current = await activePromo(m.id);
  const endsAt = promoEndsAt(now, current?.endsAt ?? null, pkg.minutes);

  const promo = await prisma.$transaction(async (tx) => {
    if (pkg.price > 0) {
      const paid = await tx.merchant.updateMany({
        where: { id: m.id, balance: { gte: pkg.price } },
        data: { balance: { decrement: pkg.price } },
      });
      if (paid.count === 0) {
        throw new AppError('Saldo mitra tidak cukup. Isi saldo dulu untuk memasang promosi.', 400);
      }
    }
    return tx.merchantPromotion.create({
      data: { merchantId: m.id, packageName: pkg.name, minutes: pkg.minutes, price: pkg.price, endsAt },
    });
  });

  return {
    id: promo.id,
    packageName: promo.packageName,
    durationLabel: durationLabel(promo.minutes),
    price: Number(promo.price),
    endsAt: promo.endsAt,
    extended: !!current, // true = menambah promosi yang masih jalan
  };
}
