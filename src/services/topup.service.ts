import bcrypt from 'bcryptjs';
import { WalletKind } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { createRedirectPayment } from '../utils/ipaymu';
import * as settingsService from './settings.service';

// ===== PIN Isi Saldo Manual (diatur admin) =====
const PIN_KEY = 'topup_pin_hash';

async function readPinHash(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: PIN_KEY } });
  return row?.value || null;
}

export async function getTopupPinStatus() {
  return { isSet: !!(await readPinHash()) };
}

export async function setTopupPin(pin: string) {
  if (!/^\d{6}$/.test(pin || '')) throw new AppError('PIN harus 6 digit angka', 400);
  if (await readPinHash()) throw new AppError('PIN sudah diatur. Gunakan reset PIN.', 400);
  const hash = await bcrypt.hash(pin, 10);
  await prisma.setting.upsert({ where: { key: PIN_KEY }, create: { key: PIN_KEY, value: hash }, update: { value: hash } });
  return { ok: true };
}

// Lupa PIN: reset dengan verifikasi password akun admin.
export async function resetTopupPin(userId: string, password: string, newPin: string) {
  if (!/^\d{6}$/.test(newPin || '')) throw new AppError('PIN harus 6 digit angka', 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Akun tidak ditemukan', 404);
  const ok = await bcrypt.compare(password || '', user.password);
  if (!ok) throw new AppError('Password akun salah', 401);
  const hash = await bcrypt.hash(newPin, 10);
  await prisma.setting.upsert({ where: { key: PIN_KEY }, create: { key: PIN_KEY, value: hash }, update: { value: hash } });
  return { ok: true };
}

export async function verifyTopupPin(pin: string) {
  const hash = await readPinHash();
  if (!hash) throw new AppError('PIN isi saldo belum diatur', 400);
  if (!(await bcrypt.compare(pin || '', hash))) throw new AppError('PIN salah', 401);
}

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://api.kilatgo.com';

export async function createTopUp(userId: string, amount: number) {
  if (!amount || amount <= 0) throw new AppError('Nominal tidak valid', 400);
  const driver = await prisma.driver.findUnique({ where: { userId }, include: { user: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);

  const settings = await settingsService.getSettings();
  const minTopup = parseFloat(settings.min_topup || '0') || 0;
  if (amount < minTopup) throw new AppError(`Minimal top up Rp${minTopup}`, 400);

  const referenceId = `TOPUP-${driver.id.slice(0, 8)}-${Date.now()}`;
  const topup = await prisma.topUp.create({
    data: { driverId: driver.id, amount, referenceId, status: 'PENDING' },
  });

  const pay = await createRedirectPayment({
    amount,
    referenceId,
    productName: 'Top Up Saldo Kredit',
    buyerName: driver.user.name,
    buyerEmail: driver.user.email,
    buyerPhone: driver.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/topup/done`,
    cancelUrl: `${PUBLIC_URL}/topup/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/topup/callback`,
  });

  if (!pay) {
    await prisma.topUp.update({ where: { id: topup.id }, data: { status: 'FAILED' } });
    throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  }

  await prisma.topUp.update({
    where: { id: topup.id },
    data: { paymentUrl: pay.url, ipaymuSessionId: pay.sessionId },
  });

  return { referenceId, paymentUrl: pay.url, amount };
}

export async function getTopUpStatus(userId: string, referenceId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId }, select: { id: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  const topup = await prisma.topUp.findFirst({ where: { referenceId, driverId: driver.id } });
  if (!topup) throw new AppError('Top up tidak ditemukan', 404);
  return { referenceId, status: topup.status, amount: Number(topup.amount) };
}

// Webhook iPaymu (form-encoded). Idempotent: hanya kredit sekali.
export async function handleCallback(params: Record<string, unknown>): Promise<void> {
  const refId = String(params.reference_id ?? params.referenceId ?? '');
  if (!refId) return;
  const topup = await prisma.topUp.findUnique({ where: { referenceId: refId } });
  if (!topup || topup.status === 'PAID') return;

  const code = String(params.status_code ?? '');
  const status = String(params.status ?? '').toLowerCase();
  const trxId = String(params.trx_id ?? params.sid ?? '');

  // Status mengikuti hasil iPaymu: sukses → kredit; gagal/batal/expired → FAILED;
  // pending/belum final → biarkan PENDING (tunggu callback berikutnya, JANGAN di-FAILED-kan).
  const success = code === '1' || status === 'berhasil' || status === 'success' || status === 'paid';
  const failed =
    code === '-2' ||
    code === '-3' ||
    code === '2' ||
    ['gagal', 'batal', 'cancel', 'expired', 'failed', 'refund'].some((s) => status.includes(s));

  if (!success) {
    if (failed) {
      // Hanya tandai FAILED bila masih PENDING (jangan timpa yang sudah PAID oleh callback lain).
      await prisma.topUp.updateMany({ where: { id: topup.id, status: 'PENDING' }, data: { status: 'FAILED', ipaymuTrxId: trxId } });
    } else if (trxId) {
      // Pending → simpan trxId saja, status tetap PENDING.
      await prisma.topUp.updateMany({ where: { id: topup.id, status: 'PENDING' }, data: { ipaymuTrxId: trxId } });
    }
    return;
  }

  const amount = Number(topup.amount);
  // Satu transaksi: flip PENDING→PAID secara ATOMIK (row-lock), lalu kredit pakai
  // `increment` (bebas race). Callback iPaymu ganda → hanya yang berhasil flip yang mengkredit.
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.topUp.updateMany({
      where: { id: topup.id, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: new Date(), ipaymuTrxId: trxId },
    });
    if (flipped.count === 0) return; // sudah dibayarkan callback lain

    if (topup.driverId) {
      const drv = await tx.driver.update({
        where: { id: topup.driverId },
        data: { creditBalance: { increment: amount } },
        select: { creditBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          driverId: topup.driverId,
          wallet: WalletKind.CREDIT,
          type: 'TOPUP',
          amount,
          balanceAfter: Number(drv.creditBalance),
          ref: refId,
          note: 'Top up kredit (iPaymu)',
        },
      });
    } else if (topup.customerId) {
      await tx.customer.update({ where: { id: topup.customerId }, data: { balance: { increment: amount } } });
    } else if (topup.merchantId) {
      // Isi saldo mitra (mis. untuk beli paket promosi).
      await tx.merchant.update({ where: { id: topup.merchantId }, data: { balance: { increment: amount } } });
    }
  });
}

// ===== Mitra (isi saldo, mis. untuk paket promosi) =====
export async function createMerchantTopUp(userId: string, amount: number) {
  if (!amount || amount <= 0) throw new AppError('Nominal tidak valid', 400);
  const merchant = await prisma.merchant.findUnique({ where: { userId }, include: { user: true } });
  if (!merchant) throw new AppError('Mitra tidak ditemukan', 404);

  const settings = await settingsService.getSettings();
  const min = parseFloat(settings.merchant_promo_min_topup || '0') || 0;
  if (amount < min) throw new AppError(`Minimal isi saldo Rp${min}`, 400);

  const referenceId = `MTOPUP-${merchant.id.slice(0, 8)}-${Date.now()}`;
  const topup = await prisma.topUp.create({ data: { merchantId: merchant.id, amount, referenceId, status: 'PENDING' } });

  const pay = await createRedirectPayment({
    amount,
    referenceId,
    productName: 'Isi Saldo Mitra KilatGo',
    buyerName: merchant.user.name,
    buyerEmail: merchant.user.email,
    buyerPhone: merchant.phone ?? merchant.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/topup/done`,
    cancelUrl: `${PUBLIC_URL}/topup/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/topup/callback`,
  });
  if (!pay) {
    await prisma.topUp.update({ where: { id: topup.id }, data: { status: 'FAILED' } });
    throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  }
  await prisma.topUp.update({ where: { id: topup.id }, data: { paymentUrl: pay.url, ipaymuSessionId: pay.sessionId } });
  return { referenceId, paymentUrl: pay.url, amount };
}

export async function getMerchantTopUpStatus(userId: string, referenceId: string) {
  const merchant = await prisma.merchant.findUnique({ where: { userId }, select: { id: true } });
  if (!merchant) throw new AppError('Mitra tidak ditemukan', 404);
  const topup = await prisma.topUp.findFirst({ where: { referenceId, merchantId: merchant.id } });
  if (!topup) throw new AppError('Top up tidak ditemukan', 404);
  return { referenceId, status: topup.status, amount: Number(topup.amount) };
}

// ===== Customer (Saldo KilatGo) =====
export async function createCustomerTopUp(userId: string, amount: number) {
  if (!amount || amount <= 0) throw new AppError('Nominal tidak valid', 400);
  const customer = await prisma.customer.findUnique({ where: { userId }, include: { user: true } });
  if (!customer) throw new AppError('Customer tidak ditemukan', 404);

  const referenceId = `CTOPUP-${customer.id.slice(0, 8)}-${Date.now()}`;
  const topup = await prisma.topUp.create({ data: { customerId: customer.id, amount, referenceId, status: 'PENDING' } });

  const pay = await createRedirectPayment({
    amount,
    referenceId,
    productName: 'Isi Saldo KilatGo',
    buyerName: customer.user.name,
    buyerEmail: customer.user.email,
    buyerPhone: customer.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/topup/done`,
    cancelUrl: `${PUBLIC_URL}/topup/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/topup/callback`,
  });
  if (!pay) {
    await prisma.topUp.update({ where: { id: topup.id }, data: { status: 'FAILED' } });
    throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  }
  await prisma.topUp.update({ where: { id: topup.id }, data: { paymentUrl: pay.url, ipaymuSessionId: pay.sessionId } });
  return { referenceId, paymentUrl: pay.url, amount };
}

export async function getCustomerTopUpStatus(userId: string, referenceId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError('Customer tidak ditemukan', 404);
  const topup = await prisma.topUp.findFirst({ where: { referenceId, customerId: customer.id } });
  if (!topup) throw new AppError('Top up tidak ditemukan', 404);
  return { referenceId, status: topup.status, amount: Number(topup.amount) };
}

// Riwayat saldo customer: top-up (masuk) + order bayar-saldo (keluar).
export async function listCustomerTopUps(userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError('Customer tidak ditemukan', 404);

  const [topups, orders, tips] = await Promise.all([
    prisma.topUp.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, amount: true, status: true, referenceId: true, paymentUrl: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { customerId: customer.id, paymentMethod: 'BALANCE', status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, totalFare: true, serviceType: true, createdAt: true },
    }),
    prisma.rating.findMany({
      where: { byRole: 'CUSTOMER', tip: { gt: 0 }, order: { customerId: customer.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, tip: true, createdAt: true },
    }),
  ]);

  const rows = [
    ...topups.map((t) => ({
      id: t.id,
      type: 'TOPUP',
      direction: 'IN',
      amount: Number(t.amount),
      status: t.status,
      referenceId: t.referenceId,
      paymentUrl: t.status === 'PENDING' ? t.paymentUrl : null, // utk lanjutkan pembayaran
      createdAt: t.createdAt,
    })),
    ...orders.map((o) => ({
      id: o.id,
      type: 'ORDER',
      direction: 'OUT',
      amount: Number(o.totalFare),
      status: 'PAID',
      serviceType: o.serviceType,
      createdAt: o.createdAt,
    })),
    ...tips.map((r) => ({
      id: r.id,
      type: 'TIP',
      direction: 'OUT',
      amount: Number(r.tip),
      status: 'PAID',
      createdAt: r.createdAt,
    })),
  ];
  rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows.slice(0, 100);
}

// Batalkan top up customer yang masih PENDING (tidak jadi bayar).
// Race-safe: callback pembayaran hanya mem-flip PENDING→PAID, jadi yang sudah CANCELLED tak bisa terbayar.
export async function cancelCustomerTopUp(userId: string, referenceId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) throw new AppError('Customer tidak ditemukan', 404);
  const flipped = await prisma.topUp.updateMany({
    where: { referenceId, customerId: customer.id, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  if (flipped.count === 0) throw new AppError('Top up tidak ditemukan atau sudah diproses', 400);
  return { ok: true };
}

export async function getCustomerBalance(userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { balance: true } });
  if (!customer) throw new AppError('Customer tidak ditemukan', 404);
  return { balance: Number(customer.balance) };
}

// ===== Admin: riwayat semua top-up (driver + customer) =====
export async function listAllTopUps() {
  const rows = await prisma.topUp.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: {
      driver: { select: { user: { select: { name: true } } } },
      customer: { select: { user: { select: { name: true } } } },
      merchant: { select: { businessName: true } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    status: t.status,
    referenceId: t.referenceId,
    role: t.merchantId ? 'MERCHANT' : t.customerId ? 'CUSTOMER' : 'DRIVER',
    who: t.merchant?.businessName ?? t.customer?.user.name ?? t.driver?.user.name ?? '-',
    note: t.note ?? null,
    createdAt: t.createdAt,
    paidAt: t.paidAt,
  }));
}

// Isi saldo manual oleh admin (penanganan urgent). Langsung PAID + saldo bertambah.
export async function adminManualTopUp(params: {
  role: 'CUSTOMER' | 'DRIVER' | 'MERCHANT';
  targetId: string; // userId untuk customer/driver, merchantId untuk mitra
  amount: number;
  pin: string;
  note?: string;
}) {
  const { role, targetId, amount, pin, note } = params;
  if (!amount || amount <= 0) throw new AppError('Nominal tidak valid', 400);
  await verifyTopupPin(pin); // gate: wajib PIN yang benar
  const now = new Date();
  const ref = `ADMIN-${role.slice(0, 3)}-${Date.now()}`;
  const base = { amount, status: 'PAID', referenceId: ref, note: note?.trim() || null, paidAt: now };

  if (role === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({ where: { userId: targetId } });
    if (!customer) throw new AppError('Pelanggan tidak ditemukan', 404);
    await prisma.$transaction([
      prisma.customer.update({ where: { id: customer.id }, data: { balance: { increment: amount } } }),
      prisma.topUp.create({ data: { ...base, customerId: customer.id } }),
    ]);
  } else if (role === 'DRIVER') {
    const driver = await prisma.driver.findUnique({ where: { userId: targetId } });
    if (!driver) throw new AppError('Driver tidak ditemukan', 404);
    const newCredit = Number(driver.creditBalance) + amount;
    await prisma.$transaction([
      prisma.driver.update({ where: { id: driver.id }, data: { creditBalance: newCredit } }),
      prisma.topUp.create({ data: { ...base, driverId: driver.id } }),
      prisma.walletTransaction.create({
        data: {
          driverId: driver.id, wallet: WalletKind.CREDIT, type: 'ADJUSTMENT',
          amount, balanceAfter: newCredit, ref, note: note?.trim() || 'Isi saldo manual admin',
        },
      }),
    ]);
  } else {
    const merchant = await prisma.merchant.findUnique({ where: { id: targetId } });
    if (!merchant) throw new AppError('Mitra tidak ditemukan', 404);
    await prisma.$transaction([
      prisma.merchant.update({ where: { id: merchant.id }, data: { balance: { increment: amount } } }),
      prisma.topUp.create({ data: { ...base, merchantId: merchant.id } }),
    ]);
  }
  return { ok: true, referenceId: ref };
}
