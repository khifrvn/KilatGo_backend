import bcrypt from 'bcryptjs';
import { KycStatus, KycSubject } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import * as settingsService from './settings.service';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Status KYC + kelengkapan untuk gating fitur tarik saldo di app.
export async function getWalletStatus(userId: string) {
  const c = await prisma.customer.findUnique({
    where: { userId },
    select: {
      balance: true, kycStatus: true, ktpPhoto: true, selfiePhoto: true,
      bankName: true, bankAccount: true, bankHolder: true, withdrawPin: true,
    },
  });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  const s = await settingsService.getSettings();
  // Catatan verifikasi terakhir (mis. alasan tolak) agar pelanggan tahu yang harus diperbaiki.
  const cust = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  let kycNote: string | null = null;
  if (cust && c.kycStatus === KycStatus.REJECTED) {
    const v = await prisma.kycVerification.findFirst({
      where: { subjectType: KycSubject.CUSTOMER, subjectId: cust.id },
      orderBy: { createdAt: 'desc' },
      select: { notes: true },
    });
    kycNote = v?.notes ?? null;
  }
  return {
    balance: Number(c.balance),
    kycStatus: c.kycStatus,
    kycNote,
    hasKtp: !!c.ktpPhoto,
    hasSelfie: !!c.selfiePhoto,
    hasBank: !!(c.bankName && c.bankAccount && c.bankHolder),
    hasPin: !!c.withdrawPin,
    bankName: c.bankName,
    bankAccount: c.bankAccount,
    bankHolder: c.bankHolder,
    minWithdraw: parseFloat(s.min_withdraw || '0') || 0,
    adminFee: parseFloat(s.withdraw_admin_fee || '0') || 0,
    canWithdraw: c.kycStatus === KycStatus.VERIFIED,
  };
}

// Kirim dokumen KYC (KTP + selfie) → status PENDING (menunggu verifikasi admin).
export async function submitKyc(userId: string, files: { ktpPhoto?: string; selfiePhoto?: string }) {
  const c = await prisma.customer.findUnique({ where: { userId } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  if (c.kycStatus === KycStatus.VERIFIED) throw new AppError('Akun sudah terverifikasi', 400);
  const ktp = files.ktpPhoto ?? c.ktpPhoto;
  const selfie = files.selfiePhoto ?? c.selfiePhoto;
  if (!ktp || !selfie) throw new AppError('Foto KTP dan selfie KTP wajib diunggah', 400);
  await prisma.customer.update({
    where: { id: c.id },
    data: { ktpPhoto: ktp, selfiePhoto: selfie, kycStatus: KycStatus.PENDING },
  });
  return { ok: true, kycStatus: KycStatus.PENDING };
}

// Simpan rekening tujuan penarikan.
export async function updateBank(userId: string, data: { bankName?: string; bankAccount?: string; bankHolder?: string }) {
  const c = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  const patch: Record<string, string> = {};
  if (data.bankName?.trim()) patch.bankName = data.bankName.trim();
  if (data.bankAccount?.trim()) patch.bankAccount = data.bankAccount.trim();
  if (data.bankHolder?.trim()) patch.bankHolder = data.bankHolder.trim();
  if (!Object.keys(patch).length) throw new AppError('Tidak ada data rekening', 400);
  await prisma.customer.update({ where: { id: c.id }, data: patch });
  return { ok: true };
}

// Buat / ganti PIN penarikan.
export async function setPin(userId: string, pin: string, oldPin?: string) {
  if (!/^\d{6}$/.test(pin)) throw new AppError('PIN harus 6 digit angka', 400);
  const c = await prisma.customer.findUnique({ where: { userId } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  if (c.withdrawPin) {
    if (!oldPin || !(await bcrypt.compare(oldPin, c.withdrawPin))) throw new AppError('PIN lama salah', 400);
  }
  await prisma.customer.update({ where: { id: c.id }, data: { withdrawPin: await bcrypt.hash(pin, 10) } });
  return { ok: true };
}

// Reset PIN (lupa PIN): verifikasi SANDI AKUN → user tentukan PIN baru sendiri.
export async function resetPin(userId: string, password: string, newPin: string) {
  if (!/^\d{6}$/.test(newPin)) throw new AppError('PIN harus 6 digit angka', 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  if (!password || !(await bcrypt.compare(password, user.password))) throw new AppError('Sandi akun salah', 401);
  const c = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  await prisma.customer.update({ where: { id: c.id }, data: { withdrawPin: await bcrypt.hash(newPin, 10) } });
  return { ok: true };
}

// Ajukan penarikan saldo. Gate: KYC VERIFIED, PIN benar, rekening lengkap, saldo cukup, 1x/hari.
export async function createWithdrawal(userId: string, amount: number, pin: string) {
  const c = await prisma.customer.findUnique({ where: { userId }, include: { user: true } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  if (c.kycStatus !== KycStatus.VERIFIED) throw new AppError('Verifikasi akun (KTP + selfie) dulu untuk bisa menarik saldo', 403);
  if (!c.withdrawPin) throw new AppError('Buat PIN penarikan dulu', 428);
  if (!pin || !(await bcrypt.compare(pin, c.withdrawPin))) throw new AppError('PIN salah', 401);

  const s = await settingsService.getSettings();
  const minWithdraw = parseFloat(s.min_withdraw || '0') || 0;
  const adminFee = parseFloat(s.withdraw_admin_fee || '0') || 0;

  if (!amount || amount < minWithdraw) throw new AppError(`Minimal tarik Rp${minWithdraw.toLocaleString('id-ID')}`, 400);
  if (amount > Number(c.balance)) throw new AppError('Saldo tidak cukup', 400);
  if (!c.bankName || !c.bankAccount || !c.bankHolder) throw new AppError('Lengkapi data rekening dulu', 400);
  if (norm(c.bankHolder) !== norm(c.user.name)) throw new AppError('Nama rekening harus sama dengan nama akun', 400);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todayCount = await prisma.customerWithdrawal.count({ where: { customerId: c.id, createdAt: { gte: startToday } } });
  if (todayCount >= 1) throw new AppError('Maksimal 1x pengajuan tarik per hari', 429);

  const net = amount - adminFee;
  if (net <= 0) throw new AppError('Nominal tarik harus lebih besar dari biaya admin', 400);

  // Potong saldo ATOMIK (guard saldo cukup) + buat pengajuan.
  const [, withdrawal] = await prisma.$transaction([
    prisma.customer.updateMany({ where: { id: c.id, balance: { gte: amount } }, data: { balance: { decrement: amount } } }),
    prisma.customerWithdrawal.create({
      data: {
        customerId: c.id, amount, adminFee, netAmount: net,
        bankName: c.bankName, bankAccount: c.bankAccount, bankHolder: c.bankHolder, status: 'PENDING',
      },
    }),
  ]);
  return withdrawal;
}

export async function listWithdrawals(userId: string) {
  const c = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!c) throw new AppError('Pelanggan tidak ditemukan', 404);
  const rows = await prisma.customerWithdrawal.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map((w) => ({
    id: w.id, amount: Number(w.amount), adminFee: Number(w.adminFee), netAmount: Number(w.netAmount),
    bankName: w.bankName, bankAccount: w.bankAccount, status: w.status,
    rejectionReason: w.rejectionReason, referenceNumber: w.referenceNumber,
    createdAt: w.createdAt, processedAt: w.processedAt,
  }));
}
