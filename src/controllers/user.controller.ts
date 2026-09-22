import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import * as userService from '../services/user.service';
import * as settingsService from '../services/settings.service';
import { successResponse } from '../utils/response';
import { UPLOAD_DIR } from '../config/upload';

type Tier = { name: string; minPoints: number };

const ALL_SERVICES = [
  { key: 'RIDE', name: 'Kilat Ride' },
  { key: 'CAR', name: 'Kilat Car' },
  { key: 'SEND', name: 'Kilat Send' },
  { key: 'FOOD', name: 'Kilat Food' },
];

// Layanan yang boleh untuk driver, tergantung tipe kendaraan terdaftar:
// CAR (mobil) → hanya Kilat Car. RIDE (motor) → Ride/Send/Food.
function allowedServiceKeys(serviceType: string): string[] {
  return serviceType === 'CAR' ? ['CAR'] : ['RIDE', 'SEND', 'FOOD'];
}

function servicesFor(serviceType: string) {
  const allow = allowedServiceKeys(serviceType);
  return ALL_SERVICES.filter((s) => allow.includes(s.key));
}

function enabledOf(driver: { enabledServices: string | null; serviceType: string }): string[] {
  return driver.enabledServices
    ? driver.enabledServices.split(',').map((s) => s.trim()).filter(Boolean)
    : [driver.serviceType];
}

// Daftar layanan + status on/off. Driver hanya dapat order untuk layanan aktif.
export async function getDriverServices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.userId } });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    const enabled = enabledOf(driver);
    successResponse(res, 'Driver services', {
      services: servicesFor(driver.serviceType).map((s) => ({ ...s, enabled: enabled.includes(s.key) })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDriverServices(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = req.body?.services;
    if (!Array.isArray(input)) {
      res.status(400).json({ success: false, message: 'services (array) wajib' });
      return;
    }
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.userId } });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    // Hanya boleh mengaktifkan layanan yang sesuai tipe kendaraan driver.
    const allow = allowedServiceKeys(driver.serviceType);
    const valid = input.filter((s: unknown) => typeof s === 'string' && allow.includes(s));
    await prisma.driver.update({
      where: { id: driver.id },
      data: { enabledServices: valid.join(',') },
    });
    successResponse(res, 'Layanan diperbarui', {
      services: servicesFor(driver.serviceType).map((s) => ({ ...s, enabled: valid.includes(s.key) })),
    });
  } catch (error) {
    next(error);
  }
}

// Ringkasan dompet driver: saldo Kredit & Pendapatan + config + ledger terakhir.
export async function getDriverWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({
      where: { userId: req.user!.userId },
      include: { user: { select: { name: true } } },
    });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    const s = await settingsService.getSettings();
    const minTopup = parseFloat(s.min_topup || '0') || 0;
    const minWithdraw = parseFloat(s.min_withdraw || '0') || 0;
    const adminFee = parseFloat(s.withdraw_admin_fee || '0') || 0;
    const commissionPercent = parseFloat(s.commission_percent || '0') || 0;
    const credit = Number(driver.creditBalance);

    const recent = await prisma.walletTransaction.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    successResponse(res, 'Driver wallet', {
      creditBalance: credit,
      earningsBalance: Number(driver.earningsBalance),
      minTopup,
      minWithdraw,
      adminFee,
      commissionPercent,
      canGoOnline: credit >= minTopup,
      hasPin: !!driver.withdrawPin,
      bankName: driver.bankName,
      bankAccount: driver.bankAccount,
      bankHolder: driver.bankHolder,
      ktpName: driver.user.name,
      recent: recent.map((t) => ({
        id: t.id,
        wallet: t.wallet,
        type: t.type,
        amount: Number(t.amount),
        balanceAfter: Number(t.balanceAfter),
        note: t.note,
        ref: t.ref,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateFcmToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.body?.fcmToken;
    if (typeof token !== 'string' || !token) {
      res.status(400).json({ success: false, message: 'fcmToken wajib' });
      return;
    }
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.userId } });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    await prisma.driver.update({ where: { id: driver.id }, data: { fcmToken: token } });
    successResponse(res, 'FCM token disimpan', { ok: true });
  } catch (error) {
    next(error);
  }
}

// Poin & status member driver. Poin = totalRides * points_per_order (dua-duanya
// dari settings/CMS). Tier ditentukan member_tiers (nama & minPoints, editable admin).
export async function getDriverStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.userId } });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    const settings = await settingsService.getSettings();
    const pointsPerOrder = parseInt(settings.points_per_order || '0', 10) || 0;

    let tiers: Tier[] = [];
    try {
      const parsed = JSON.parse(settings.member_tiers || '[]');
      if (Array.isArray(parsed)) {
        tiers = parsed
          .filter((t) => t && typeof t.name === 'string')
          .map((t) => ({ name: String(t.name), minPoints: Number(t.minPoints) || 0 }))
          .sort((a, b) => a.minPoints - b.minPoints);
      }
    } catch {
      /* tiers kosong → tanpa tier */
    }

    const points = driver.totalRides * pointsPerOrder;
    let tier: Tier | null = tiers[0] ?? null;
    let nextTier: Tier | null = null;
    for (const t of tiers) {
      if (points >= t.minPoints) tier = t;
      else {
        nextTier = t;
        break;
      }
    }
    const pointsToNext = nextTier ? Math.max(0, nextTier.minPoints - points) : 0;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const ordersToday = await prisma.order.count({
      where: { driverId: driver.id, status: OrderStatus.COMPLETED, completedAt: { gte: start } },
    });

    successResponse(res, 'Driver stats', {
      points,
      pointsPerOrder,
      totalOrders: driver.totalRides,
      tier,
      nextTier,
      pointsToNext,
      ordersToday,
    });
  } catch (error) {
    next(error);
  }
}

// Penghasilan driver: net = totalFare - komisi platform (commission_percent, dari settings).
// Ringkasan hari ini / 7 hari / total + daftar order selesai terakhir.
export async function getDriverEarnings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await prisma.driver.findUnique({ where: { userId: req.user!.userId } });
    if (!driver) {
      res.status(404).json({ success: false, message: 'Driver tidak ditemukan' });
      return;
    }
    const settings = await settingsService.getSettings();
    const commission = parseFloat(settings.commission_percent || '0') || 0;
    const share = 1 - commission / 100;

    const orders = await prisma.order.findMany({
      where: { driverId: driver.id, status: OrderStatus.COMPLETED },
      select: {
        id: true,
        serviceType: true,
        totalFare: true,
        completedAt: true,
        acceptedAt: true,
        distanceKm: true,
        paymentMethod: true,
        pickupAddress: true,
        dropoffAddress: true,
      },
      orderBy: { completedAt: 'desc' },
    });

    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6); // 7 hari termasuk hari ini

    let today = 0;
    let week = 0;
    let total = 0;
    let ordersToday = 0;
    let ordersWeek = 0;
    for (const o of orders) {
      const net = Math.round(Number(o.totalFare) * share);
      total += net;
      const c = o.completedAt;
      if (c && c >= startToday) {
        today += net;
        ordersToday += 1;
      }
      if (c && c >= startWeek) {
        week += net;
        ordersWeek += 1;
      }
    }

    // Kelompokkan per tanggal (WIB, UTC+7) — buat riwayat harian.
    type Day = { date: string; total: number; count: number; orders: unknown[] };
    const dailyMap = new Map<string, Day>();
    for (const o of orders) {
      if (!o.completedAt) continue;
      const wib = new Date(o.completedAt.getTime() + 7 * 3600 * 1000);
      const key = wib.toISOString().slice(0, 10); // YYYY-MM-DD (WIB)
      const net = Math.round(Number(o.totalFare) * share);
      let g = dailyMap.get(key);
      if (!g) {
        g = { date: key, total: 0, count: 0, orders: [] };
        dailyMap.set(key, g);
      }
      g.total += net;
      g.count += 1;
      g.orders.push({
        id: o.id,
        serviceType: o.serviceType,
        totalFare: Number(o.totalFare),
        earning: net,
        completedAt: o.completedAt,
        acceptedAt: o.acceptedAt,
        distanceKm: o.distanceKm,
        paymentMethod: o.paymentMethod,
        pickupAddress: o.pickupAddress,
        dropoffAddress: o.dropoffAddress,
      });
    }
    const daily = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    successResponse(res, 'Driver earnings', {
      today,
      week,
      total,
      ordersToday,
      ordersWeek,
      ordersTotal: orders.length,
      commissionPercent: commission,
      daily,
    });
  } catch (error) {
    next(error);
  }
}

// Serve the logged-in driver's OWN KYC selfie (dipakai sebagai foto profil di app).
export async function getMyDriverPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = (await userService.getProfile(req.user!.userId)) as {
      driver?: { selfiePhoto?: string | null } | null;
    };
    const name = profile?.driver?.selfiePhoto;
    if (!name) {
      res.status(404).json({ success: false, message: 'Foto tidak ada' });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, path.basename(name)); // basename cegah path traversal
    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.getProfile(req.user!.userId);
    successResponse(res, 'Profile retrieved', profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.updateProfile(req.user!.userId, req.body);
    successResponse(res, 'Profile updated', profile);
  } catch (error) {
    next(error);
  }
}

// Ulasan pelanggan untuk driver (list rating diterima).
export async function getDriverReviews(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    successResponse(res, 'Ulasan', await userService.getDriverReviews(req.user!.userId));
  } catch (error) {
    next(error);
  }
}

// Simpan token FCM user (push notifikasi customer).
export async function updateUserFcmToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = String(req.body.fcmToken ?? req.body.fcm_token ?? '').trim();
    if (!token) {
      res.status(400).json({ success: false, message: 'fcmToken wajib' });
      return;
    }
    successResponse(res, 'FCM token disimpan', await userService.updateFcmToken(req.user!.userId, token));
  } catch (error) {
    next(error);
  }
}

// Unggah foto profil (multipart field 'avatar').
export async function uploadAvatar(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filename = (req.file as Express.Multer.File | undefined)?.filename;
    if (!filename) {
      res.status(400).json({ success: false, message: 'Foto wajib diunggah' });
      return;
    }
    const result = await userService.updateAvatar(req.user!.userId, filename);
    successResponse(res, 'Foto profil diperbarui', result);
  } catch (error) {
    next(error);
  }
}

export async function updateDriverProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.updateDriverProfile(req.user!.userId, req.body);
    successResponse(res, 'Driver profile updated', profile);
  } catch (error) {
    next(error);
  }
}

export async function listDrivers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const drivers = await userService.listDrivers(req.query);
    successResponse(res, 'Drivers retrieved', drivers);
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customers = await userService.listCustomers();
    successResponse(res, 'Customers retrieved', customers);
  } catch (error) {
    next(error);
  }
}

export async function approveDriver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await userService.approveDriver(req.params.id, req.body.isApproved, req.body.notes);
    successResponse(res, 'Driver approval updated', driver);
  } catch (error) {
    next(error);
  }
}

export async function listAllUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await userService.listAllUsers(req.query.role as any);
    successResponse(res, 'Users retrieved', users);
  } catch (error) {
    next(error);
  }
}
