import { UserRole, UserStatus, KycSubject, KycStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as kycService from './kyc.service';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customer: true,
      driver: true,
      admin: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { password, ...profile } = user;
  return profile;
}

export async function updateAvatar(userId: string, filename: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: filename },
    select: { id: true, avatar: true },
  });
  return user;
}

export async function updateFcmToken(userId: string, fcmToken: string) {
  await prisma.user.update({ where: { id: userId }, data: { fcmToken } });
  return { ok: true };
}

export async function updateProfile(userId: string, data: { name?: string; phone?: string; address?: string }) {
  if (data.phone) {
    const existing = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        NOT: { id: userId },
      },
    });

    if (existing) {
      throw new AppError('Phone number already in use', 409);
    }
  }

  // Nama terkunci bila akun sudah terverifikasi (mengikuti KTP) — berlaku customer & driver.
  // Ubah nama lewat CS/admin.
  if (data.name !== undefined) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, customer: { select: { kycStatus: true } }, driver: { select: { kycStatus: true } } },
    });
    const verified = me?.customer?.kycStatus === 'VERIFIED' || me?.driver?.kycStatus === 'VERIFIED';
    if (verified && data.name.trim() !== me?.name) {
      throw new AppError('Nama tidak bisa diubah karena akun sudah terverifikasi (mengikuti KTP).', 400);
    }
  }

  // Alamat disimpan di profil customer (bukan di User).
  const { address, ...userData } = data;
  if (address !== undefined) {
    await prisma.customer.updateMany({
      where: { userId },
      data: { address: address.trim() || null },
    });
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: userData,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      customer: { select: { address: true } },
    },
  });

  return user;
}

export async function updateDriverProfile(
  userId: string,
  data: { vehicleType?: string; vehiclePlate?: string; licenseNumber?: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driver: true },
  });

  if (!user || user.role !== UserRole.DRIVER || !user.driver) {
    throw new AppError('Driver profile not found', 404);
  }

  const updatedDriver = await prisma.driver.update({
    where: { userId },
    data,
    include: { user: true },
  });

  return updatedDriver;
}

export async function listDrivers(options: { status?: UserStatus; isApproved?: boolean } = {}) {
  const where: any = {};

  if (options.status) {
    where.user = { status: options.status };
  }

  if (options.isApproved !== undefined) {
    where.isApproved = options.isApproved;
  }

  const drivers = await prisma.driver.findMany({
    where,
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

// Ulasan pelanggan untuk driver (rating byRole=CUSTOMER pada order driver ini).
export async function getDriverReviews(userId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true, rating: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  const ratings = await prisma.rating.findMany({
    where: { byRole: 'CUSTOMER', order: { driverId: driver.id } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      stars: true,
      comment: true,
      tip: true,
      createdAt: true,
      order: { select: { serviceType: true, customer: { select: { user: { select: { name: true } } } } } },
    },
  });
  return {
    average: Number(driver.rating),
    total: ratings.length,
    reviews: ratings.map((r) => ({
      stars: r.stars,
      comment: r.comment,
      tip: Number(r.tip),
      createdAt: r.createdAt,
      serviceType: r.order.serviceType,
      customer: r.order.customer.user.name,
    })),
  };
}

export async function listCustomers() {
  const customers = await prisma.customer.findMany({
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

  return customers;
}

export async function approveDriver(driverId: string, isApproved: boolean, notes?: string) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: true },
  });

  if (!driver) {
    throw new AppError('Driver not found', 404);
  }

  // Catat hasil review + set kycStatus (VERIFIED/REJECTED) sekalian audit trail di kyc_verifications.
  // Tanpa ini "Tolak" tak mengubah apa pun (driver pending sudah isApproved=false + status PENDING).
  await kycService.verify(KycSubject.DRIVER, driverId, { approve: isApproved, notes });

  const updatedDriver = await prisma.driver.update({
    where: { id: driverId },
    data: {
      isApproved,
      // Ditolak → driver offline supaya tidak ikut dispatch bila sebelumnya sudah aktif.
      ...(isApproved ? {} : { status: 'OFFLINE' as const }),
      user: {
        update: {
          status: isApproved ? UserStatus.ACTIVE : UserStatus.PENDING,
        },
      },
    },
    include: { user: true },
  });

  return updatedDriver;
}

// ===== Pendaftaran driver yang ditolak: tahan 3 hari, lalu hapus otomatis =====
// Ditahan supaya tidak bisa spam daftar-ulang; setelah lewat, akun (email & no HP)
// dibebaskan agar driver bisa mendaftar lagi dari nol.
export const REJECT_HOLD_MS = 3 * 24 * 60 * 60 * 1000;

// Kapan driver ini ditolak — dari audit kyc_verifications. Driver yang ditolak
// sebelum audit ini ada (atau datanya hilang) → pakai updatedAt.
async function rejectedAt(driver: { id: string; updatedAt: Date }): Promise<Date> {
  const last = await prisma.kycVerification.findFirst({
    where: { subjectType: KycSubject.DRIVER, subjectId: driver.id, status: KycStatus.REJECTED },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return last?.createdAt ?? driver.updatedAt;
}

/**
 * Cek satu akun user: kalau dia driver yang ditolak, apakah masa tahan 3 hari sudah lewat?
 * - null      → bukan driver ditolak (tidak ada yang dihapus)
 * - deleted   → akun lama sudah dihapus, boleh daftar ulang
 * - !deleted  → masih ditahan, retryAt = kapan boleh daftar ulang
 */
export async function purgeRejectedDriverUser(
  userId: string
): Promise<{ deleted: boolean; retryAt: Date } | null> {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    select: { id: true, updatedAt: true, isApproved: true, kycStatus: true },
  });
  if (!driver || driver.isApproved || driver.kycStatus !== KycStatus.REJECTED) return null;

  const retryAt = new Date((await rejectedAt(driver)).getTime() + REJECT_HOLD_MS);
  if (retryAt > new Date()) return { deleted: false, retryAt };

  await prisma.user.delete({ where: { id: userId } }); // driver + dokumennya ikut (cascade)
  return { deleted: true, retryAt };
}

// Sweeper: bersihkan daftar "Ditolak" di CMS dari pendaftaran yang sudah > 3 hari.
export async function purgeExpiredRejectedDrivers(): Promise<number> {
  const rejected = await prisma.driver.findMany({
    where: { isApproved: false, kycStatus: KycStatus.REJECTED },
    select: { userId: true },
  });

  let deleted = 0;
  // ponytail: 1-2 query per driver ditolak — daftarnya selalu kecil. Kalau membengkak,
  // ganti dengan kolom rejected_at di tabel drivers + satu deleteMany.
  for (const { userId } of rejected) {
    try {
      if ((await purgeRejectedDriverUser(userId))?.deleted) deleted++;
    } catch (err) {
      console.error(`[reject-purge] gagal hapus user ${userId}`, err);
    }
  }
  return deleted;
}

export function startRejectedDriverPurgeSweeper(): void {
  const runOnce = async () => {
    try {
      const n = await purgeExpiredRejectedDrivers();
      if (n) console.log(`[reject-purge] hapus ${n} pendaftaran driver ditolak > 3 hari`);
    } catch (err) {
      console.error('[reject-purge] sweep gagal', err);
    }
  };
  runOnce();
  setInterval(runOnce, 60 * 60 * 1000); // tiap 1 jam
}

export async function listAllUsers(role?: UserRole) {
  const where = role ? { role } : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      avatar: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      // Profil customer (saldo, rating) untuk detail di admin.
      customer: { select: { balance: true, rating: true, totalRatings: true, totalRides: true } },
      // Foto profil driver (selfie, privat) & logo mitra (publik) untuk avatar daftar.
      driver: { select: { selfiePhoto: true } },
      merchant: { select: { logo: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users;
}
