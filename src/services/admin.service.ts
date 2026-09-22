import { DriverStatus, OrderStatus, PaymentStatus, UserRole, UserStatus, WalletKind, KycStatus, KycSubject } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as settingsService from './settings.service';
import { verifyTopupPin } from './topup.service';
import * as orderService from './order.service';

// Jumlah item yang butuh tindakan admin — untuk badge angka di sidebar CMS.
// approval = driver+merchant belum disetujui + KYC pelanggan menunggu.
// packages = paket driver yang sudah dibayar tapi belum diproses (VERIFIED).
// withdrawals = penarikan (driver/mitra/pelanggan) yang masih PENDING.
export async function getPendingCounts() {
  const [pendingDrivers, pendingMerchants, pendingCustomers, packages, wDriver, wMerchant, wCustomer] =
    await Promise.all([
      // Driver yang sudah ditolak tidak lagi butuh tindakan admin.
      prisma.driver.count({ where: { isApproved: false, kycStatus: { not: KycStatus.REJECTED } } }),
      prisma.merchant.count({ where: { isApproved: false } }),
      prisma.customer.count({ where: { kycStatus: KycStatus.PENDING } }),
      prisma.driverPackageOrder.count({ where: { status: 'VERIFIED' as any } }),
      prisma.withdrawal.count({ where: { status: 'PENDING' as any } }),
      prisma.merchantWithdrawal.count({ where: { status: 'PENDING' as any } }),
      prisma.customerWithdrawal.count({ where: { status: 'PENDING' as any } }),
    ]);
  return {
    approval: pendingDrivers + pendingMerchants + pendingCustomers,
    packages,
    withdrawals: wDriver + wMerchant + wCustomer,
  };
}

// ===== Rating & ulasan (isi komentarnya, bukan cuma jumlah) =====
// target: siapa yang DINILAI (DRIVER | MERCHANT | CUSTOMER). subjectId (opsional) =
// driver.id / merchant.id / customer.id untuk melihat ulasan satu pihak saja.
export async function listRatings(params: {
  target?: string;
  subjectId?: string;
  stars?: number;
  withComment?: boolean;
  q?: string;
  limit?: number;
}) {
  const { target, subjectId, stars, withComment, q } = params;
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const where: Record<string, unknown> = {};
  if (target) where.target = target;
  if (stars) where.stars = stars;
  // Komentar kosong tetap tersimpan sbg null/'' — filter "hanya berkomentar" buang keduanya.
  if (withComment) where.AND = [{ comment: { not: null } }, { NOT: { comment: '' } }];
  if (subjectId) {
    const key = target === 'MERCHANT' ? 'merchantId' : target === 'CUSTOMER' ? 'customerId' : 'driverId';
    where.order = { [key]: subjectId };
  }
  if (q?.trim()) {
    const s = q.trim();
    where.OR = [
      { comment: { contains: s } },
      { order: { orderNumber: { contains: s } } },
      { order: { customer: { user: { name: { contains: s } } } } },
      { order: { driver: { user: { name: { contains: s } } } } },
      { order: { merchant: { businessName: { contains: s } } } },
    ];
  }

  const [rows, byStars] = await Promise.all([
    prisma.rating.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, target: true, byRole: true, stars: true, comment: true, tip: true, createdAt: true,
        order: {
          select: {
            id: true, orderNumber: true, serviceType: true,
            customerId: true, driverId: true, merchantId: true,
            customer: { select: { user: { select: { name: true } } } },
            driver: { select: { user: { select: { name: true } } } },
            merchant: { select: { businessName: true } },
          },
        },
      },
    }),
    // Sebaran bintang atas SEMUA data yang cocok filter (bukan cuma halaman ini).
    prisma.rating.groupBy({ by: ['stars'], where, _count: { _all: true } }),
  ]);

  const data = rows.map((r) => {
    const o = r.order;
    const driverName = o.driver?.user.name ?? null;
    const customerName = o.customer?.user.name ?? null;
    const merchantName = o.merchant?.businessName ?? null;
    const subject =
      r.target === 'MERCHANT'
        ? { type: 'MERCHANT', id: o.merchantId, name: merchantName }
        : r.target === 'CUSTOMER'
          ? { type: 'CUSTOMER', id: o.customerId, name: customerName }
          : { type: 'DRIVER', id: o.driverId, name: driverName };
    return {
      id: r.id,
      target: r.target,
      byRole: r.byRole,
      stars: r.stars,
      comment: r.comment?.trim() || null,
      tip: Number(r.tip),
      createdAt: r.createdAt,
      order: { id: o.id, orderNumber: o.orderNumber, serviceType: o.serviceType },
      subject, // yang dinilai
      author: { role: r.byRole, name: r.byRole === 'DRIVER' ? driverName : customerName }, // yang menilai
    };
  });

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  let sum = 0;
  for (const g of byStars) {
    const n = g._count._all;
    dist[g.stars] = n;
    total += n;
    sum += g.stars * n;
  }
  return {
    summary: { total, average: total ? Number((sum / total).toFixed(2)) : null, distribution: dist },
    ratings: data,
  };
}

export async function listWithdrawals(status?: string) {
  const where = status ? { status } : {};
  const [drivers, merchants, customers] = await Promise.all([
    prisma.withdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { driver: { include: { user: { select: { name: true, phone: true } } } } },
    }),
    prisma.merchantWithdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { merchant: { select: { businessName: true, phone: true, user: { select: { phone: true } } } } },
    }),
    prisma.customerWithdrawal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { customer: { include: { user: { select: { name: true, phone: true } } } } },
    }),
  ]);

  const driverRows = drivers.map((w) => ({
    id: w.id,
    type: 'driver' as const,
    partyName: w.driver.user.name,
    partyPhone: w.driver.user.phone,
    driverName: w.driver.user.name, // kompat frontend lama
    amount: Number(w.amount),
    adminFee: Number(w.adminFee),
    netAmount: Number(w.netAmount),
    bankName: w.bankName,
    bankAccount: w.bankAccount,
    bankHolder: w.bankHolder,
    status: w.status,
    rejectionReason: w.rejectionReason,
    referenceNumber: w.referenceNumber,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
  }));

  const merchantRows = merchants.map((w) => ({
    id: w.id,
    type: 'merchant' as const,
    partyName: w.merchant.businessName,
    partyPhone: w.merchant.phone ?? w.merchant.user.phone,
    driverName: w.merchant.businessName, // kompat frontend lama
    amount: Number(w.amount),
    adminFee: 0,
    netAmount: Number(w.amount),
    bankName: w.bankName,
    bankAccount: w.bankAccount,
    bankHolder: w.bankHolder,
    status: w.status,
    rejectionReason: w.rejectionReason,
    referenceNumber: null as string | null,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
  }));

  const customerRows = customers.map((w) => ({
    id: w.id,
    type: 'customer' as const,
    partyName: w.customer.user.name,
    partyPhone: w.customer.user.phone,
    driverName: w.customer.user.name, // kompat frontend lama
    amount: Number(w.amount),
    adminFee: Number(w.adminFee),
    netAmount: Number(w.netAmount),
    bankName: w.bankName,
    bankAccount: w.bankAccount,
    bankHolder: w.bankHolder,
    status: w.status,
    rejectionReason: w.rejectionReason,
    referenceNumber: w.referenceNumber,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
  }));

  return [...driverRows, ...merchantRows, ...customerRows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// KYC pelanggan untuk halaman Persetujuan (default: yang butuh tindakan = PENDING).
export async function listCustomerKyc(status?: string) {
  const where = status ? { kycStatus: status as any } : { kycStatus: { in: [KycStatus.PENDING, KycStatus.VERIFIED, KycStatus.REJECTED] as any } };
  const rows = await prisma.customer.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: {
      id: true, kycStatus: true, ktpPhoto: true, selfiePhoto: true,
      bankName: true, bankAccount: true, bankHolder: true, updatedAt: true,
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  // Catatan verifikasi terakhir per pelanggan (alasan tolak) untuk ditampilkan admin.
  const verifs = await prisma.kycVerification.findMany({
    where: { subjectType: KycSubject.CUSTOMER, subjectId: { in: rows.map((c) => c.id) } },
    orderBy: { createdAt: 'desc' },
    select: { subjectId: true, notes: true },
  });
  const noteMap = new Map<string, string | null>();
  for (const v of verifs) if (!noteMap.has(v.subjectId)) noteMap.set(v.subjectId, v.notes);
  return rows.map((c) => ({
    id: c.id,
    name: c.user.name,
    email: c.user.email,
    phone: c.user.phone,
    kycStatus: c.kycStatus,
    ktpPhoto: c.ktpPhoto,
    selfiePhoto: c.selfiePhoto,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankHolder: c.bankHolder,
    note: noteMap.get(c.id) ?? null,
    updatedAt: c.updatedAt,
  }));
}

// Hapus/reset KYC pelanggan → status UNVERIFIED + hapus foto, agar wajib verifikasi ulang
// (mis. pindah dari KTP orang tua ke KTP sendiri). Riwayat verifikasi tetap tersimpan (audit).
export async function resetCustomerKyc(customerId: string) {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  await prisma.customer.update({
    where: { id: customerId },
    data: { kycStatus: KycStatus.UNVERIFIED, ktpPhoto: null, selfiePhoto: null },
  });
  return { ok: true };
}

export async function approveWithdrawal(id: string, referenceNumber?: string) {
  const w = await prisma.withdrawal.findUnique({ where: { id } });
  if (w) {
    if (w.status !== 'PENDING' && w.status !== 'PROCESSING') throw new AppError('Penarikan sudah diproses', 400);
    return prisma.withdrawal.update({
      where: { id },
      data: { status: 'COMPLETED', referenceNumber: referenceNumber?.trim() || null, processedAt: new Date() },
    });
  }
  // Penarikan mitra (tanpa kolom referenceNumber).
  const m = await prisma.merchantWithdrawal.findUnique({ where: { id } });
  if (m) {
    if (m.status !== 'PENDING' && m.status !== 'PROCESSING') throw new AppError('Penarikan sudah diproses', 400);
    return prisma.merchantWithdrawal.update({ where: { id }, data: { status: 'COMPLETED', processedAt: new Date() } });
  }
  // Penarikan pelanggan.
  const cw = await prisma.customerWithdrawal.findUnique({ where: { id } });
  if (!cw) throw new AppError('Penarikan tidak ditemukan', 404);
  if (cw.status !== 'PENDING' && cw.status !== 'PROCESSING') throw new AppError('Penarikan sudah diproses', 400);
  return prisma.customerWithdrawal.update({
    where: { id },
    data: { status: 'COMPLETED', referenceNumber: referenceNumber?.trim() || null, processedAt: new Date() },
  });
}

export async function rejectWithdrawal(id: string, reason: string) {
  if (!reason || !reason.trim()) throw new AppError('Alasan penolakan wajib diisi', 400);
  const w = await prisma.withdrawal.findUnique({ where: { id } });
  if (!w) {
    // Penarikan mitra: tolak + kembalikan saldo merchant.
    const m = await prisma.merchantWithdrawal.findUnique({ where: { id } });
    if (m) {
      if (m.status !== 'PENDING' && m.status !== 'PROCESSING') throw new AppError('Penarikan sudah diproses', 400);
      await prisma.$transaction([
        prisma.merchantWithdrawal.update({
          where: { id },
          data: { status: 'REJECTED', rejectionReason: reason.trim(), processedAt: new Date() },
        }),
        prisma.merchant.update({ where: { id: m.merchantId }, data: { balance: { increment: Number(m.amount) } } }),
      ]);
      return { ok: true };
    }
    // Penarikan pelanggan: tolak + kembalikan saldo pelanggan.
    const cw = await prisma.customerWithdrawal.findUnique({ where: { id } });
    if (!cw) throw new AppError('Penarikan tidak ditemukan', 404);
    if (cw.status !== 'PENDING' && cw.status !== 'PROCESSING') throw new AppError('Penarikan sudah diproses', 400);
    await prisma.$transaction([
      prisma.customerWithdrawal.update({
        where: { id },
        data: { status: 'REJECTED', rejectionReason: reason.trim(), processedAt: new Date() },
      }),
      prisma.customer.update({ where: { id: cw.customerId }, data: { balance: { increment: Number(cw.amount) } } }),
    ]);
    return { ok: true };
  }
  if (w.status !== 'PENDING' && w.status !== 'PROCESSING') {
    throw new AppError('Penarikan sudah diproses', 400);
  }
  const driver = await prisma.driver.findUnique({ where: { id: w.driverId }, select: { earningsBalance: true } });
  const newEarnings = Number(driver!.earningsBalance) + Number(w.amount);
  await prisma.$transaction([
    prisma.withdrawal.update({
      where: { id },
      data: { status: 'REJECTED', rejectionReason: reason.trim(), processedAt: new Date() },
    }),
    prisma.driver.update({ where: { id: w.driverId }, data: { earningsBalance: newEarnings } }),
    prisma.walletTransaction.create({
      data: {
        driverId: w.driverId,
        wallet: WalletKind.EARNINGS,
        type: 'REFUND',
        amount: Number(w.amount),
        balanceAfter: newEarnings,
        ref: w.id,
        note: 'Refund penarikan ditolak',
      },
    }),
  ]);
  return { ok: true };
}

// Pendapatan platform (biaya layanan + komisi driver + komisi mitra) untuk order sesuai `where`.
// Rumus tunggal dipakai Dasbor (lifetime) & halaman Pendapatan (per periode) agar konsisten.
async function sumPlatformRevenue(where: Record<string, unknown>): Promise<number> {
  const settings = await settingsService.getSettings();
  const commissionPct = parseFloat(settings.commission_percent || '0') || 0;
  const foodCommissionPct = parseFloat(settings.food_commission_percent || '0') || 0;
  const orders = await prisma.order.findMany({
    where,
    select: { serviceType: true, totalFare: true, serviceFee: true, itemsTotal: true },
  });
  let sum = 0;
  for (const o of orders) {
    const total = Number(o.totalFare);
    const svcFee = Number(o.serviceFee || 0);
    const items = Number(o.itemsTotal || 0);
    const driverFare = Math.max(0, total - svcFee - items);
    const driverCommission = Math.round((driverFare * commissionPct) / 100);
    const foodCommission = o.serviceType === 'FOOD' ? Math.round((items * foodCommissionPct) / 100) : 0;
    sum += svcFee + driverCommission + foodCommission;
  }
  return sum;
}

export async function getDashboardStats() {
  const [
    totalUsers,
    totalCustomers,
    totalDrivers,
    totalMerchants,
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    pendingDrivers,
    totalEarnings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    prisma.user.count({ where: { role: UserRole.DRIVER } }),
    prisma.user.count({ where: { role: UserRole.MERCHANT } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
    prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    prisma.driver.count({ where: { isApproved: false } }),
    // Pendapatan platform lifetime — rumus SAMA dengan halaman Pendapatan (biaya layanan + komisi).
    sumPlatformRevenue({ status: OrderStatus.COMPLETED }),
  ]);

  const [
    earningsTrend,
    ordersTrend,
    userGrowth,
    driverStatusDistribution,
    orderStatusDistribution,
    recentOrders,
    topDrivers,
  ] = await Promise.all([
    getEarningsTrend(14),
    getOrdersTrend(14),
    getUserGrowth(14),
    getDriverStatusDistribution(),
    getOrderStatusDistribution(),
    getRecentOrders(5),
    getTopDrivers(5),
  ]);

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      drivers: totalDrivers,
      merchants: totalMerchants,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
      cancelled: cancelledOrders,
    },
    drivers: {
      pendingApproval: pendingDrivers,
    },
    earnings: totalEarnings,
    earningsTrend,
    ordersTrend,
    userGrowth,
    driverStatusDistribution,
    orderStatusDistribution,
    recentOrders,
    topDrivers,
  };
}

async function getEarningsTrend(days: number) {
  const result: { date: string; amount: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    // Pendapatan platform harian (konsisten dengan headline & halaman Pendapatan).
    const amount = await sumPlatformRevenue({
      status: OrderStatus.COMPLETED,
      completedAt: { gte: date, lt: nextDate },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      amount,
    });
  }

  return result;
}

async function getOrdersTrend(days: number) {
  const result: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.order.count({
      where: {
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  return result;
}

async function getUserGrowth(days: number) {
  const result: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.user.count({
      where: {
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  return result;
}

async function getDriverStatusDistribution() {
  const [online, offline, busy] = await Promise.all([
    prisma.driver.count({ where: { status: DriverStatus.ONLINE } }),
    prisma.driver.count({ where: { status: DriverStatus.OFFLINE } }),
    prisma.driver.count({ where: { status: DriverStatus.BUSY } }),
  ]);

  return [
    { status: 'ONLINE', count: online, color: '#22c55e' },
    { status: 'OFFLINE', count: offline, color: '#64748b' },
    { status: 'BUSY', count: busy, color: '#facc15' },
  ];
}

async function getOrderStatusDistribution() {
  const statuses = [
    { status: OrderStatus.PENDING, color: '#facc15' },
    { status: OrderStatus.ACCEPTED, color: '#3b82f6' },
    { status: OrderStatus.DRIVER_ARRIVED, color: '#6366f1' },
    { status: OrderStatus.ON_RIDE, color: '#a855f7' },
    { status: OrderStatus.COMPLETED, color: '#22c55e' },
    { status: OrderStatus.CANCELLED, color: '#ef4444' },
  ];

  const result = await Promise.all(
    statuses.map(async (item) => ({
      status: item.status,
      count: await prisma.order.count({ where: { status: item.status } }),
      color: item.color,
    }))
  );

  return result;
}

async function getRecentOrders(limit: number) {
  const orders = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
      driver: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
    },
  });

  return orders;
}

async function getTopDrivers(limit: number) {
  const drivers = await prisma.driver.findMany({
    where: { isApproved: true },
    take: limit,
    orderBy: { totalRides: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, avatar: true } },
    },
  });

  return drivers;
}

export async function getAllOrders(filters: {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        driver: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Laporan pendapatan PROPER — dari ORDER SELESAI (termasuk tunai), dengan struktur
// komisi asli: pendapatan platform = biaya layanan + komisi driver + komisi KilatFood.
export async function getEarningsReport(filters: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const settings = await settingsService.getSettings();
  const commissionPct = parseFloat(settings.commission_percent || '0') || 0;
  const foodCommissionPct = parseFloat(settings.food_commission_percent || '0') || 0;

  const where: any = { status: OrderStatus.COMPLETED };
  if (filters.startDate || filters.endDate) {
    where.completedAt = {};
    if (filters.startDate) where.completedAt.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1); // inklusif sampai akhir hari
      where.completedAt.lt = end;
    }
  }

  const orders = await prisma.order.findMany({
    where,
    select: {
      id: true,
      serviceType: true,
      totalFare: true,
      baseFare: true,
      serviceFee: true,
      itemsTotal: true,
      discount: true,
      paymentMethod: true,
      completedAt: true,
      createdAt: true,
      customer: { select: { user: { select: { name: true } } } },
    },
    orderBy: { completedAt: 'desc' },
  });

  let gmv = 0; // nilai transaksi (total dibayar customer)
  let platformRevenue = 0; // pendapatan platform (komisi + biaya layanan)
  let driverPayout = 0; // bersih ke driver
  let merchantPayout = 0; // bersih ke mitra (FOOD)

  const rows = orders.map((o) => {
    const total = Number(o.totalFare);
    const svcFee = Number(o.serviceFee || 0);
    const items = Number(o.itemsTotal || 0);
    const driverFare = Math.max(0, total - svcFee - items); // ongkir (jatah driver)
    const driverCommission = Math.round((driverFare * commissionPct) / 100);
    const foodCommission = o.serviceType === 'FOOD' ? Math.round((items * foodCommissionPct) / 100) : 0;
    const platform = svcFee + driverCommission + foodCommission;

    gmv += total;
    platformRevenue += platform;
    driverPayout += driverFare - driverCommission;
    merchantPayout += items - foodCommission;

    return {
      id: o.id,
      serviceType: o.serviceType,
      totalFare: total,
      driverFare,
      itemsTotal: items,
      serviceFee: svcFee,
      platformRevenue: platform,
      paymentMethod: o.paymentMethod,
      customerName: o.customer?.user?.name ?? '-',
      completedAt: o.completedAt,
      createdAt: o.createdAt,
    };
  });

  return {
    gmv,
    platformRevenue,
    driverPayout,
    merchantPayout,
    count: orders.length,
    commissionPct,
    foodCommissionPct,
    orders: rows,
  };
}

export async function getPendingDrivers() {
  const drivers = await prisma.driver.findMany({
    where: { isApproved: false, kycStatus: { not: KycStatus.REJECTED } },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return drivers;
}

export async function suspendUser(userId: string, reason?: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.SUSPENDED, suspendReason: reason?.trim() || null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  return user;
}

export async function activateUser(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE, suspendReason: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  return user;
}

// ===== RBAC: kelola akun admin (superadmin only) =====
import bcrypt from 'bcryptjs';
import { PERMISSION_KEYS } from '../middleware/rbac.middleware';

function normPerms(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((k): k is string => typeof k === 'string' && (PERMISSION_KEYS as readonly string[]).includes(k));
}

export async function listAdmins() {
  const admins = await prisma.admin.findMany({
    orderBy: [{ isSuperAdmin: 'desc' }, { createdAt: 'asc' }],
    include: { user: { select: { id: true, name: true, email: true, phone: true, status: true, avatar: true, createdAt: true } } },
  });
  return admins.map((a) => ({
    id: a.id,
    userId: a.userId,
    name: a.user.name,
    email: a.user.email,
    phone: a.user.phone,
    avatar: a.user.avatar,
    status: a.user.status,
    isSuperAdmin: a.isSuperAdmin,
    permissions: (() => { try { return a.permissions ? JSON.parse(a.permissions) : []; } catch { return []; } })(),
    createdAt: a.user.createdAt,
  }));
}

export async function createAdmin(input: { name: string; email: string; phone: string; password: string; permissions?: string[]; isSuperAdmin?: boolean }) {
  const email = (input.email || '').trim().toLowerCase();
  const phone = (input.phone || '').trim();
  if (!input.name?.trim()) throw new AppError('Nama wajib diisi', 400);
  if (!email) throw new AppError('Email wajib diisi', 400);
  if (!phone) throw new AppError('Nomor telepon wajib diisi', 400);
  if (!input.password || input.password.length < 6) throw new AppError('Password minimal 6 karakter', 400);
  const dup = await prisma.user.findFirst({ where: { OR: [{ email }, { phone }] } });
  if (dup) throw new AppError('Email atau telepon sudah terdaftar', 409);
  const hashed = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(), email, phone, password: hashed,
      role: UserRole.ADMIN, status: UserStatus.ACTIVE,
      admin: { create: { isSuperAdmin: !!input.isSuperAdmin, permissions: JSON.stringify(normPerms(input.permissions)) } },
    },
  });
  return { id: user.id, ok: true };
}

export async function updateAdmin(adminId: string, requesterUserId: string, patch: { name?: string; permissions?: string[]; isSuperAdmin?: boolean; status?: string; password?: string }) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { user: true } });
  if (!admin) throw new AppError('Admin tidak ditemukan', 404);
  const isSelf = admin.userId === requesterUserId;

  // Cegah superadmin menurunkan/menonaktifkan dirinya sendiri (hindari terkunci).
  if (isSelf && (patch.isSuperAdmin === false || patch.status === 'SUSPENDED')) {
    throw new AppError('Tidak bisa menurunkan atau menonaktifkan akun sendiri', 400);
  }
  // Jangan sampai superadmin terakhir hilang.
  if (admin.isSuperAdmin && patch.isSuperAdmin === false) {
    const supers = await prisma.admin.count({ where: { isSuperAdmin: true } });
    if (supers <= 1) throw new AppError('Minimal harus ada satu superadmin', 400);
  }

  const userData: Record<string, unknown> = {};
  if (patch.name?.trim()) userData.name = patch.name.trim();
  if (patch.status === 'ACTIVE' || patch.status === 'SUSPENDED') userData.status = patch.status;
  if (patch.password) {
    if (patch.password.length < 6) throw new AppError('Password minimal 6 karakter', 400);
    userData.password = await bcrypt.hash(patch.password, 10);
  }
  const adminData: Record<string, unknown> = {};
  if (patch.permissions !== undefined) adminData.permissions = JSON.stringify(normPerms(patch.permissions));
  if (patch.isSuperAdmin !== undefined) adminData.isSuperAdmin = !!patch.isSuperAdmin;

  await prisma.$transaction([
    ...(Object.keys(userData).length ? [prisma.user.update({ where: { id: admin.userId }, data: userData })] : []),
    ...(Object.keys(adminData).length ? [prisma.admin.update({ where: { id: adminId }, data: adminData })] : []),
  ]);
  return { ok: true };
}

export async function deleteAdmin(adminId: string, requesterUserId: string) {
  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) throw new AppError('Admin tidak ditemukan', 404);
  if (admin.userId === requesterUserId) throw new AppError('Tidak bisa menghapus akun sendiri', 400);
  if (admin.isSuperAdmin) {
    const supers = await prisma.admin.count({ where: { isSuperAdmin: true } });
    if (supers <= 1) throw new AppError('Minimal harus ada satu superadmin', 400);
  }
  await prisma.user.delete({ where: { id: admin.userId } }); // cascade hapus admin row
  return { ok: true };
}

// ===== Akses semua akun (bantuan helpdesk: edit profil, saldo, kata sandi) =====

// Muat akun + relasi peran (saldo & alamat). Dipakai halaman "Akses Akun".
export async function getUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, phone: true, avatar: true, role: true, status: true, createdAt: true,
      customer: { select: { id: true, balance: true, address: true } },
      driver: { select: {
        id: true, nik: true, birthDate: true, address: true, city: true, serviceType: true,
        simType: true, simNumber: true, simExpiry: true, vehicleType: true, vehiclePlate: true,
        vehicleBrand: true, vehicleYear: true, vehicleColor: true, stnkNumber: true, licenseNumber: true,
        bankName: true, bankAccount: true, bankHolder: true, npwp: true,
        creditBalance: true, earningsBalance: true,
        selfiePhoto: true, ktpPhoto: true, simPhoto: true, stnkPhoto: true, skckPhoto: true,
      } },
      merchant: { select: {
        id: true, businessName: true, category: true, description: true, ownerName: true, nik: true,
        phone: true, address: true, city: true, operatingHours: true,
        bankName: true, bankAccount: true, bankHolder: true, npwp: true, nib: true, siup: true, balance: true,
        logo: true, ktpPhoto: true, outletPhoto: true, npwpPhoto: true,
      } },
    },
  });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  return user;
}

function genPassword(): string {
  // 8 karakter, tanpa 0/O/1/l/I yang ambigu. Tak butuh acak kripto untuk sandi sementara.
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Field profil yang boleh diedit admin per peran (whitelist — cegah ubah id/saldo/dll lewat body).
const DRIVER_FIELDS = ['nik', 'birthDate', 'address', 'city', 'serviceType', 'simType', 'simNumber', 'simExpiry', 'vehicleType', 'vehiclePlate', 'vehicleBrand', 'vehicleYear', 'vehicleColor', 'stnkNumber', 'licenseNumber', 'bankName', 'bankAccount', 'bankHolder', 'npwp'] as const;
const MERCHANT_FIELDS = ['businessName', 'category', 'description', 'ownerName', 'nik', 'phone', 'address', 'city', 'operatingHours', 'bankName', 'bankAccount', 'bankHolder', 'npwp', 'nib', 'siup'] as const;
const CUSTOMER_FIELDS = ['address'] as const;
const DATE_FIELDS = new Set(['birthDate', 'simExpiry']);
const INT_FIELDS = new Set(['vehicleYear']);

// Ambil hanya field yang di-whitelist, kosongkan ke null, koersi tanggal & angka.
function pickRoleData(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  const src = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in src)) continue;
    const raw = src[key];
    const val = typeof raw === 'string' ? raw.trim() : raw;
    if (val === '' || val === null || val === undefined) { out[key] = null; continue; }
    if (DATE_FIELDS.has(key)) { const d = new Date(val as string); out[key] = isNaN(d.getTime()) ? null : d; }
    else if (INT_FIELDS.has(key)) { const n = parseInt(String(val), 10); out[key] = isNaN(n) ? null : n; }
    else out[key] = val;
  }
  return out;
}

// Edit profil akun mana pun (lengkap seperti form daftar). `password` set eksplisit; `resetPassword` buat sandi acak.
export async function updateUserAccount(userId: string, patch: {
  name?: string; email?: string; phone?: string;
  driver?: Record<string, unknown>; merchant?: Record<string, unknown>; customer?: Record<string, unknown>;
  password?: string; resetPassword?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { driver: true, merchant: true, customer: true } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);

  const email = patch.email?.trim().toLowerCase();
  const phone = patch.phone?.trim();
  if (email || phone) {
    const dup = await prisma.user.findFirst({
      where: { id: { not: userId }, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
      select: { email: true, phone: true },
    });
    if (dup?.email === email) throw new AppError('Email sudah dipakai akun lain', 409);
    if (dup?.phone === phone) throw new AppError('Nomor HP sudah dipakai akun lain', 409);
  }

  const userData: Record<string, unknown> = {};
  if (patch.name?.trim()) userData.name = patch.name.trim();
  if (email) userData.email = email;
  if (phone) userData.phone = phone;

  let tempPassword: string | undefined;
  const newPassword = patch.resetPassword ? genPassword() : patch.password;
  if (newPassword) {
    if (newPassword.length < 6) throw new AppError('Kata sandi minimal 6 karakter', 400);
    userData.password = await bcrypt.hash(newPassword, 10);
    if (patch.resetPassword) tempPassword = newPassword;
  }

  const ops: any[] = [];
  if (Object.keys(userData).length) ops.push(prisma.user.update({ where: { id: userId }, data: userData }));
  if (user.driver && patch.driver) {
    const data = pickRoleData(patch.driver, DRIVER_FIELDS);
    if (Object.keys(data).length) ops.push(prisma.driver.update({ where: { id: user.driver.id }, data }));
  }
  if (user.merchant && patch.merchant) {
    const data = pickRoleData(patch.merchant, MERCHANT_FIELDS);
    if (Object.keys(data).length) ops.push(prisma.merchant.update({ where: { id: user.merchant.id }, data }));
  }
  if (user.customer && patch.customer) {
    const data = pickRoleData(patch.customer, CUSTOMER_FIELDS);
    if (Object.keys(data).length) ops.push(prisma.customer.update({ where: { id: user.customer.id }, data }));
  }
  if (ops.length) await prisma.$transaction(ops);

  return { ok: true, tempPassword, account: await getUserAccount(userId) };
}

// Hapus akun permanen. Gagal (terbaca ramah) bila masih punya riwayat pesanan (FK Order = restrict).
export async function deleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  if (user.role === UserRole.ADMIN) throw new AppError('Akun admin dihapus lewat menu Admin & Hak Akses', 400);
  try {
    await prisma.user.delete({ where: { id: userId } }); // cascade ke customer/driver/merchant
  } catch (e: any) {
    if (e?.code === 'P2003') throw new AppError('Akun punya riwayat pesanan, tidak bisa dihapus permanen. Blokir akun sebagai gantinya.', 409);
    throw e;
  }
  return { ok: true };
}

// Tambah/kurangi saldo akun. `amount` bertanda (+/-). Driver pilih dompet CREDIT/EARNINGS (default EARNINGS).
// Wajib PIN isi saldo yang sama dengan halaman Isi Saldo (satu PIN untuk semua penyesuaian saldo).
export async function adjustUserBalance(userId: string, input: { amount: number; wallet?: 'CREDIT' | 'EARNINGS'; note?: string; pin?: string }) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new AppError('Nominal tidak valid', 400);
  await verifyTopupPin(input.pin || ''); // gate: PIN sama seperti Isi Saldo
  const note = input.note?.trim() || 'Penyesuaian saldo oleh admin';
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { customer: true, driver: true, merchant: true } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);

  if (user.customer) {
    const after = Number(user.customer.balance) + amount;
    if (after < 0) throw new AppError('Saldo tidak boleh minus', 400);
    await prisma.customer.update({ where: { id: user.customer.id }, data: { balance: after } });
  } else if (user.merchant) {
    const after = Number(user.merchant.balance) + amount;
    if (after < 0) throw new AppError('Saldo tidak boleh minus', 400);
    await prisma.merchant.update({ where: { id: user.merchant.id }, data: { balance: after } });
  } else if (user.driver) {
    const wallet = input.wallet === 'CREDIT' ? WalletKind.CREDIT : WalletKind.EARNINGS;
    const field = wallet === WalletKind.CREDIT ? 'creditBalance' : 'earningsBalance';
    const after = Number(user.driver[field]) + amount;
    if (after < 0) throw new AppError('Saldo tidak boleh minus', 400);
    await prisma.$transaction([
      prisma.driver.update({ where: { id: user.driver.id }, data: { [field]: after } }),
      prisma.walletTransaction.create({
        data: { driverId: user.driver.id, wallet, type: 'ADJUSTMENT', amount, balanceAfter: after, note },
      }),
    ]);
  } else {
    throw new AppError('Akun ini tidak memiliki saldo', 400);
  }
  return { ok: true, account: await getUserAccount(userId) };
}

// ===== Update status order (admin) =====
// Admin ubah status order dari CMS (mis. membetulkan order nyangkut).
// Delegasi ke order.service supaya SEMUA efeknya ikut: komisi & pendapatan driver,
// kredit merchant, refund saldo, bebaskan driver, push ke customer. Jangan duplikat
// logika di sini — order selesai tanpa settlement = driver tak dibayar.
export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  if (!Object.values(OrderStatus).includes(status)) {
    throw new AppError('Status tidak valid', 400);
  }
  return orderService.updateOrderStatus(orderId, '', UserRole.ADMIN, status, { adminOverride: true });
}
