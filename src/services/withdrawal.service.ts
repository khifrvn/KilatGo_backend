import bcrypt from 'bcryptjs';
import { WalletKind } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as settingsService from './settings.service';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Buat / ganti PIN penarikan.
export async function setPin(userId: string, pin: string, oldPin?: string) {
  if (!/^\d{6}$/.test(pin)) throw new AppError('PIN harus 6 digit angka', 400);
  const driver = await prisma.driver.findUnique({ where: { userId } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  if (driver.withdrawPin) {
    if (!oldPin || !(await bcrypt.compare(oldPin, driver.withdrawPin))) {
      throw new AppError('PIN lama salah', 400);
    }
  }
  await prisma.driver.update({ where: { id: driver.id }, data: { withdrawPin: await bcrypt.hash(pin, 10) } });
  return { ok: true };
}

// Reset PIN (lupa PIN): verifikasi SANDI AKUN → user tentukan PIN baru sendiri.
// KilatGo tak pernah tahu PIN pengguna, jadi reset harus lewat sandi akun mereka.
export async function resetPin(userId: string, password: string, newPin: string) {
  if (!/^\d{6}$/.test(newPin)) throw new AppError('PIN harus 6 digit angka', 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  if (!password || !(await bcrypt.compare(password, user.password))) throw new AppError('Sandi akun salah', 401);
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  await prisma.driver.update({ where: { id: driver.id }, data: { withdrawPin: await bcrypt.hash(newPin, 10) } });
  return { ok: true };
}

export async function createWithdrawal(userId: string, amount: number, pin: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, include: { user: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);

  if (!driver.withdrawPin) throw new AppError('Buat PIN penarikan dulu', 428);
  if (!pin || !(await bcrypt.compare(pin, driver.withdrawPin))) throw new AppError('PIN salah', 401);

  const s = await settingsService.getSettings();
  const minWithdraw = parseFloat(s.min_withdraw || '0') || 0;
  const adminFee = parseFloat(s.withdraw_admin_fee || '0') || 0;

  if (!amount || amount < minWithdraw) throw new AppError(`Minimal tarik Rp${minWithdraw}`, 400);
  if (amount > Number(driver.earningsBalance)) throw new AppError('Saldo pendapatan tidak cukup', 400);

  // Rekening wajib lengkap & nama rekening = nama KTP (nama terdaftar).
  if (!driver.bankName || !driver.bankAccount || !driver.bankHolder) {
    throw new AppError('Lengkapi data rekening di profil dulu', 400);
  }
  if (norm(driver.bankHolder) !== norm(driver.user.name)) {
    throw new AppError('Nama rekening harus sama dengan nama pada KTP terdaftar', 400);
  }

  // Limit 1x pengajuan per hari.
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todayCount = await prisma.withdrawal.count({
    where: { driverId: driver.id, createdAt: { gte: startToday } },
  });
  if (todayCount >= 1) throw new AppError('Maksimal 1x pengajuan tarik per hari', 429);

  const net = amount - adminFee;
  if (net <= 0) throw new AppError('Nominal tarik harus lebih besar dari biaya admin', 400);

  const newEarnings = Number(driver.earningsBalance) - amount;

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.create({
      data: {
        driverId: driver.id,
        amount,
        adminFee,
        netAmount: net,
        bankName: driver.bankName,
        bankAccount: driver.bankAccount,
        bankHolder: driver.bankHolder,
        status: 'PENDING',
      },
    }),
    prisma.driver.update({ where: { id: driver.id }, data: { earningsBalance: newEarnings } }),
    prisma.walletTransaction.create({
      data: {
        driverId: driver.id,
        wallet: WalletKind.EARNINGS,
        type: 'WITHDRAWAL',
        amount: -amount,
        balanceAfter: newEarnings,
        note: 'Pengajuan penarikan',
      },
    }),
  ]);

  return withdrawal;
}

export async function listWithdrawals(userId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  const rows = await prisma.withdrawal.findMany({
    where: { driverId: driver.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows.map((w) => ({
    id: w.id,
    amount: Number(w.amount),
    adminFee: Number(w.adminFee),
    netAmount: Number(w.netAmount),
    bankName: w.bankName,
    bankAccount: w.bankAccount,
    status: w.status,
    rejectionReason: w.rejectionReason,
    referenceNumber: w.referenceNumber,
    createdAt: w.createdAt,
    processedAt: w.processedAt,
  }));
}
