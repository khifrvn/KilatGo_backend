import bcrypt from 'bcryptjs';
import { UserRole, UserStatus, OrderStatus, ServiceType } from '@prisma/client';
import { prisma } from '../config/database';
import { generateTokens } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';
import { sendToToken } from '../utils/fcm';
import * as dispatchService from './dispatch.service';
import * as settingsService from './settings.service';
import * as merchantPromoService from './merchantPromo.service';

export interface RegisterMerchantInput {
  email: string;
  password: string;
  phone: string;
  ownerName: string;
  businessName: string;
  category?: string;
  nik?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  operatingHours?: string;
  npwp?: string;
  nib?: string;
  siup?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  // dokumen
  ktpPhoto?: string;
  outletPhoto?: string;
  npwpPhoto?: string;
}

export async function registerMerchant(input: RegisterMerchantInput) {
  const settings = await settingsService.getSettings();
  if (settings.merchant_registration_open === '0') {
    throw new AppError('Pendaftaran mitra sedang ditutup untuk saat ini.', 403);
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }] },
  });
  if (existing) throw new AppError('Email or phone number already registered', 409);

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      name: input.ownerName,
      role: UserRole.MERCHANT,
      status: UserStatus.PENDING,
      merchant: {
        create: {
          businessName: input.businessName,
          category: input.category,
          ownerName: input.ownerName,
          nik: input.nik,
          phone: input.phone,
          address: input.address,
          city: input.city,
          latitude: input.latitude,
          longitude: input.longitude,
          operatingHours: input.operatingHours,
          npwp: input.npwp,
          nib: input.nib,
          siup: input.siup,
          bankName: input.bankName,
          bankAccount: input.bankAccount,
          bankHolder: input.bankHolder,
          ktpPhoto: input.ktpPhoto,
          outletPhoto: input.outletPhoto,
          npwpPhoto: input.npwpPhoto,
        },
      },
    },
  });

  const { accessToken, refreshToken } = generateTokens({ userId: user.id, email: user.email, role: user.role });
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, status: user.status },
  };
}

export async function listMerchants() {
  return prisma.merchant.findMany({
    include: {
      user: { select: { id: true, email: true, name: true, phone: true, status: true, createdAt: true } },
      menus: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listPendingMerchants() {
  return prisma.merchant.findMany({
    where: { isApproved: false },
    include: { user: { select: { id: true, email: true, name: true, phone: true, status: true, createdAt: true } }, menus: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMerchant(id: string) {
  const m = await prisma.merchant.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, phone: true, status: true } }, menus: true },
  });
  if (!m) throw new AppError('Merchant not found', 404);
  return m;
}

export async function approveMerchant(id: string, approve: boolean) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) throw new AppError('Merchant not found', 404);

  if (approve) {
    return prisma.merchant.update({
      where: { id },
      data: { isApproved: true, user: { update: { status: UserStatus.ACTIVE } } },
    });
  }
  // reject → hapus akun merchant
  await prisma.user.delete({ where: { id: merchant.userId } });
  return { id, rejected: true };
}

// ===== Menu =====
export async function getMerchantByUser(userId: string) {
  const m = await prisma.merchant.findUnique({
    where: { userId },
    include: { menus: true, categories: { orderBy: { createdAt: 'asc' } } },
  });
  if (!m) throw new AppError('Merchant profile not found', 404);
  return m;
}

// ===== Kategori =====
async function merchantIdOf(userId: string) {
  const m = await prisma.merchant.findUnique({ where: { userId }, select: { id: true } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  return m.id;
}

export async function listCategories(userId: string) {
  const merchantId = await merchantIdOf(userId);
  return prisma.merchantCategory.findMany({ where: { merchantId }, orderBy: { createdAt: 'asc' } });
}

export async function addCategory(userId: string, name: string) {
  const merchantId = await merchantIdOf(userId);
  const exists = await prisma.merchantCategory.findFirst({ where: { merchantId, name } });
  if (exists) throw new AppError('Kategori sudah ada', 409);
  return prisma.merchantCategory.create({ data: { merchantId, name } });
}

export async function renameCategory(userId: string, id: string, name: string) {
  const merchantId = await merchantIdOf(userId);
  const cat = await prisma.merchantCategory.findFirst({ where: { id, merchantId } });
  if (!cat) throw new AppError('Kategori tidak ditemukan', 404);
  // ikut ubah menu yang memakai nama kategori lama
  await prisma.merchantMenu.updateMany({ where: { merchantId, category: cat.name }, data: { category: name } });
  return prisma.merchantCategory.update({ where: { id }, data: { name } });
}

export async function deleteCategory(userId: string, id: string) {
  const merchantId = await merchantIdOf(userId);
  const cat = await prisma.merchantCategory.findFirst({ where: { id, merchantId } });
  if (!cat) throw new AppError('Kategori tidak ditemukan', 404);
  await prisma.merchantCategory.delete({ where: { id } });
  return { id, deleted: true };
}

export async function addMenu(userId: string, input: { name: string; price: number; description?: string; category?: string; photo?: string }) {
  const merchant = await prisma.merchant.findUnique({ where: { userId } });
  if (!merchant) throw new AppError('Merchant profile not found', 404);
  return prisma.merchantMenu.create({
    data: {
      merchantId: merchant.id,
      name: input.name,
      price: input.price,
      description: input.description,
      category: input.category,
      photo: input.photo,
    },
  });
}

async function ownMenu(userId: string, menuId: string) {
  const merchantId = await merchantIdOf(userId);
  const menu = await prisma.merchantMenu.findFirst({ where: { id: menuId, merchantId } });
  if (!menu) throw new AppError('Menu tidak ditemukan', 404);
  return menu;
}

export async function updateMenu(
  userId: string,
  menuId: string,
  input: { name?: string; price?: number; description?: string; category?: string; isAvailable?: boolean; photo?: string; stock?: number | null },
) {
  await ownMenu(userId, menuId);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.price !== undefined) data.price = input.price;
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.isAvailable !== undefined) data.isAvailable = input.isAvailable;
  if (input.photo !== undefined) data.photo = input.photo;
  if (input.stock !== undefined) data.stock = input.stock;
  return prisma.merchantMenu.update({ where: { id: menuId }, data });
}

export async function deleteMenu(userId: string, menuId: string) {
  await ownMenu(userId, menuId);
  await prisma.merchantMenu.delete({ where: { id: menuId } });
  return { id: menuId, deleted: true };
}

// ===== Order masuk ke merchant (KilatFood) =====

const orderInclude = {
  customer: { include: { user: { select: { name: true, phone: true } } } },
  driver: { include: { user: { select: { name: true, phone: true } } } },
  items: true,
} as const;

export async function listMerchantOrders(userId: string, status?: OrderStatus) {
  const merchantId = await merchantIdOf(userId);
  const where: { merchantId: string; status?: OrderStatus } = { merchantId };
  if (status) where.status = status;
  return prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' } });
}

export async function getMerchantOrder(userId: string, orderId: string) {
  const merchantId = await merchantIdOf(userId);
  const order = await prisma.order.findFirst({ where: { id: orderId, merchantId }, include: orderInclude });
  if (!order) throw new AppError('Order tidak ditemukan', 404);
  return order; // pickupCode disertakan — merchant yg membacakannya ke driver
}

export async function acceptOrder(userId: string, orderId: string) {
  const merchantId = await merchantIdOf(userId);
  const order = await prisma.order.findFirst({ where: { id: orderId, merchantId } });
  if (!order) throw new AppError('Order tidak ditemukan', 404);
  if (order.status !== OrderStatus.PENDING) throw new AppError('Order tidak bisa diterima', 400);
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.MERCHANT_ACCEPTED },
    include: orderInclude,
  });
  // Merchant terima → mulai cari driver (langkah 4).
  dispatchService.startDispatch(orderId).catch(() => {});
  return updated;
}

export async function rejectOrder(userId: string, orderId: string, reason?: string) {
  const merchantId = await merchantIdOf(userId);
  const order = await prisma.order.findFirst({ where: { id: orderId, merchantId } });
  if (!order) throw new AppError('Order tidak ditemukan', 404);
  if (order.status !== OrderStatus.PENDING) throw new AppError('Order tidak bisa ditolak', 400);
  return prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: reason || 'Ditolak merchant' },
    include: orderInclude,
  });
}

export async function updateMe(
  userId: string,
  input: { isOpen?: boolean; operatingHours?: string; operatingSchedule?: unknown },
) {
  const merchantId = await merchantIdOf(userId);
  const data: Record<string, unknown> = {};
  if (input.isOpen !== undefined) data.isOpen = input.isOpen;
  if (input.operatingHours !== undefined) data.operatingHours = input.operatingHours;
  if (input.operatingSchedule !== undefined) data.operatingSchedule = input.operatingSchedule;
  await prisma.merchant.update({ where: { id: merchantId }, data });
  return getMerchantByUser(userId);
}

export async function updateProfile(
  userId: string,
  input: {
    businessName?: string;
    category?: string;
    description?: string;
    phone?: string;
    address?: string;
    city?: string;
    bankName?: string;
    bankAccount?: string;
    bankHolder?: string;
  },
  logo?: string,
) {
  const merchantId = await merchantIdOf(userId);
  const data: Record<string, unknown> = {};
  if (input.businessName !== undefined) data.businessName = input.businessName;
  if (input.category !== undefined) data.category = input.category;
  if (input.description !== undefined) data.description = input.description;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;
  if (input.city !== undefined) data.city = input.city;
  if (input.bankName !== undefined) data.bankName = input.bankName;
  if (input.bankAccount !== undefined) data.bankAccount = input.bankAccount;
  if (input.bankHolder !== undefined) data.bankHolder = input.bankHolder;
  if (logo !== undefined) data.logo = logo;
  await prisma.merchant.update({ where: { id: merchantId }, data });
  return getMerchantByUser(userId);
}

// Admin moderasi menu (mis. foto tidak pantas) — bypass kepemilikan.
export async function adminSetMenuAvailability(menuId: string, isAvailable: boolean) {
  const menu = await prisma.merchantMenu.findUnique({ where: { id: menuId } });
  if (!menu) throw new AppError('Menu tidak ditemukan', 404);
  return prisma.merchantMenu.update({ where: { id: menuId }, data: { isAvailable } });
}

// ===== Laporan mitra (admin) =====
const ACTIVE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.MERCHANT_ACCEPTED,
  OrderStatus.ACCEPTED,
  OrderStatus.DRIVER_ARRIVED,
  OrderStatus.ON_RIDE,
];

export async function getReport(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true, balance: true } });
  if (!merchant) throw new AppError('Merchant not found', 404);
  const settings = await settingsService.getSettings();
  const minWithdraw = parseFloat(settings.min_withdraw || '0') || 0;

  const orders = await prisma.order.findMany({
    where: { merchantId },
    select: { status: true, itemsTotal: true, totalFare: true, createdAt: true },
  });
  const completed = orders.filter((o) => o.status === OrderStatus.COMPLETED);
  const sum = (arr: typeof completed) => arr.reduce((s, o) => s + Number(o.itemsTotal ?? 0), 0);

  const cancelled = orders.filter((o) => o.status === OrderStatus.CANCELLED);
  // Order valid = semua kecuali dibatalkan (yang masuk & diproses, termasuk yang masih jalan).
  const valid = orders.filter((o) => o.status !== OrderStatus.CANCELLED);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const validToday = valid.filter((o) => o.createdAt >= startToday);

  // Omzet order selesai per hari, 7 hari terakhir (untuk grafik).
  const series: { date: string; sales: number; orders: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    const dayOrders = completed.filter((o) => o.createdAt >= d && o.createdAt < next);
    series.push({ date: d.toISOString().slice(0, 10), sales: sum(dayOrders), orders: dayOrders.length });
  }

  // Skor performa = tingkat penyelesaian (selesai / yang sudah tuntas). null bila belum ada.
  const finished = completed.length + cancelled.length;
  const performanceScore = finished === 0 ? null : Math.round((completed.length / finished) * 100);

  return {
    balance: merchant.balance,
    minWithdraw,
    totalOrders: orders.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    activeOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    grossSales: sum(completed),
    todayOrders: validToday.length, // order masuk hari ini (non-batal)
    todaySales: sum(validToday), // penjualan kotor hari ini (order valid)
    avgOrderValue: completed.length ? Math.round(sum(completed) / completed.length) : 0,
    performanceScore,
    series,
  };
}

export async function getMyReport(userId: string) {
  return getReport(await merchantIdOf(userId));
}

// ===== Saldo & penarikan (Payment Link) =====

export async function getWallet(userId: string) {
  const m = await prisma.merchant.findUnique({
    where: { userId },
    select: { id: true, balance: true, bankName: true, bankAccount: true, bankHolder: true },
  });
  if (!m) throw new AppError('Merchant profile not found', 404);
  const withdrawals = await prisma.merchantWithdrawal.findMany({
    where: { merchantId: m.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const settings = await settingsService.getSettings();
  const minWithdraw = parseFloat(settings.min_withdraw || '0') || 0;
  return {
    balance: m.balance,
    minWithdraw,
    bankName: m.bankName,
    bankAccount: m.bankAccount,
    bankHolder: m.bankHolder,
    withdrawals,
  };
}

// Status PIN penarikan mitra (untuk gating UI di app).
export async function getWithdrawPinStatus(userId: string) {
  const m = await prisma.merchant.findUnique({ where: { userId }, select: { withdrawPin: true } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  return { hasPin: !!m.withdrawPin };
}

// Buat / ganti PIN penarikan mitra.
export async function setWithdrawPin(userId: string, pin: string, oldPin?: string) {
  if (!/^\d{6}$/.test(pin)) throw new AppError('PIN harus 6 digit angka', 400);
  const m = await prisma.merchant.findUnique({ where: { userId } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  if (m.withdrawPin) {
    if (!oldPin || !(await bcrypt.compare(oldPin, m.withdrawPin))) throw new AppError('PIN lama salah', 400);
  }
  await prisma.merchant.update({ where: { id: m.id }, data: { withdrawPin: await bcrypt.hash(pin, 10) } });
  return { ok: true };
}

// Reset PIN (lupa PIN): verifikasi SANDI AKUN → mitra tentukan PIN baru sendiri.
export async function resetWithdrawPin(userId: string, password: string, newPin: string) {
  if (!/^\d{6}$/.test(newPin)) throw new AppError('PIN harus 6 digit angka', 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  if (!password || !(await bcrypt.compare(password, user.password))) throw new AppError('Sandi akun salah', 401);
  const m = await prisma.merchant.findUnique({ where: { userId }, select: { id: true } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  await prisma.merchant.update({ where: { id: m.id }, data: { withdrawPin: await bcrypt.hash(newPin, 10) } });
  return { ok: true };
}

export async function createWithdrawal(userId: string, amount: number, pin: string) {
  const m = await prisma.merchant.findUnique({ where: { userId } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  if (!m.bankName || !m.bankAccount || !m.bankHolder) {
    throw new AppError('Lengkapi data rekening pencairan dulu', 400);
  }
  if (!m.withdrawPin) throw new AppError('Buat PIN penarikan dulu', 428);
  if (!pin || !(await bcrypt.compare(pin, m.withdrawPin))) throw new AppError('PIN salah', 401);
  if (!amount || amount <= 0) throw new AppError('Nominal tidak valid', 400);
  const s = await settingsService.getSettings();
  const minWithdraw = parseFloat(s.min_withdraw || '0') || 0;
  if (amount < minWithdraw) {
    throw new AppError(`Minimal penarikan Rp${minWithdraw.toLocaleString('id-ID')}`, 400);
  }
  if (amount > Number(m.balance)) throw new AppError('Saldo tidak cukup', 400);
  const [withdrawal] = await prisma.$transaction([
    prisma.merchantWithdrawal.create({
      data: {
        merchantId: m.id,
        amount,
        bankName: m.bankName,
        bankAccount: m.bankAccount,
        bankHolder: m.bankHolder,
        status: 'PENDING',
      },
    }),
    prisma.merchant.update({ where: { id: m.id }, data: { balance: { decrement: amount } } }),
  ]);
  return withdrawal;
}

export async function setFcmToken(userId: string, token: string) {
  const merchantId = await merchantIdOf(userId);
  await prisma.merchant.update({ where: { id: merchantId }, data: { fcmToken: token } });
  return { updated: true };
}

// Push notif ke merchant saat order FOOD baru masuk (langkah 2).
export async function notifyMerchantNewOrder(merchantId: string, orderId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { fcmToken: true } });
  if (!merchant?.fcmToken) return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { itemsTotal: true } });
  const total = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(order?.itemsTotal ?? 0)
  );
  await sendToToken(
    merchant.fcmToken,
    { title: 'Pesanan baru masuk! 🍽️', body: `Pesanan ${total} menunggu konfirmasi` },
    { type: 'new_order', orderId }
  );
}

// ===== Browse publik (customer KilatFood) =====

// Rating warung = rata-rata rating CUSTOMER pada order-order warung tsb (satu query utk semua).
async function merchantRatings(merchantIds: string[]) {
  if (!merchantIds.length) return {} as Record<string, { rating: number; ratingCount: number }>;
  const rs = await prisma.rating.findMany({
    where: { byRole: 'CUSTOMER', order: { merchantId: { in: merchantIds } } },
    select: { stars: true, order: { select: { merchantId: true } } },
  });
  const agg: Record<string, { sum: number; n: number }> = {};
  for (const r of rs) {
    const id = r.order.merchantId!;
    agg[id] = agg[id] || { sum: 0, n: 0 };
    agg[id].sum += r.stars;
    agg[id].n++;
  }
  const out: Record<string, { rating: number; ratingCount: number }> = {};
  for (const [id, a] of Object.entries(agg)) out[id] = { rating: a.sum / a.n, ratingCount: a.n };
  return out;
}

export async function listPublicMerchants() {
  const merchants = await prisma.merchant.findMany({
    where: { isApproved: true, isOpen: true },
    select: {
      id: true, businessName: true, category: true, city: true, address: true, logo: true,
      latitude: true, longitude: true, outletPhoto: true, operatingHours: true,
      _count: { select: { menus: true } },
    },
    orderBy: { businessName: 'asc' },
  });
  const ids = merchants.map((m) => m.id);
  const [ratings, promoEnds] = await Promise.all([merchantRatings(ids), merchantPromoService.activePromoEnds(ids)]);
  // Mitra yang membayar promosi tampil paling atas (app juga menandainya "Promosi").
  return merchants
    .map((m) => ({
      ...m,
      rating: ratings[m.id]?.rating ?? null,
      ratingCount: ratings[m.id]?.ratingCount ?? 0,
      promotedUntil: promoEnds[m.id] ?? null,
    }))
    .sort((a, b) => {
      const p = (b.promotedUntil ? 1 : 0) - (a.promotedUntil ? 1 : 0);
      return p !== 0 ? p : a.businessName.localeCompare(b.businessName);
    });
}

export async function getPublicMerchant(id: string) {
  const m = await prisma.merchant.findFirst({
    where: { id, isApproved: true },
    select: {
      id: true, businessName: true, category: true, description: true, logo: true, city: true, address: true,
      latitude: true, longitude: true, outletPhoto: true, operatingHours: true, operatingSchedule: true, isOpen: true, phone: true,
      menus: { where: { isAvailable: true }, orderBy: { category: 'asc' } },
    },
  });
  if (!m) throw new AppError('Warung tidak ditemukan', 404);
  const ratings = await merchantRatings([m.id]);
  return { ...m, rating: ratings[m.id]?.rating ?? null, ratingCount: ratings[m.id]?.ratingCount ?? 0 };
}
