import { DriverPackageStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { createRedirectPayment } from '../utils/ipaymu';
import * as settingsService from './settings.service';

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://api.kilatgo.com';
const PACKAGE_ITEMS = ['Jacket Driver', 'Helm SNI Driver'];
// Batas bayar paket: lewat ini & belum dibayar → batal (dihapus). Link iPaymu sudah lama mati.
const PACKAGE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 jam

// Urutan status untuk mencegah admin melompat mundur sembarangan (opsional, longgar).
const STATUS_FLOW: DriverPackageStatus[] = [
  DriverPackageStatus.PENDING_PAYMENT,
  DriverPackageStatus.VERIFIED,
  DriverPackageStatus.PROCESSING,
  DriverPackageStatus.SHIPPING,
  DriverPackageStatus.RECEIVED,
  DriverPackageStatus.COMPLETED,
];

async function getPrice(): Promise<number> {
  const s = await settingsService.getSettings();
  return Math.max(0, Number(s.driver_package_price) || 0);
}

// Info paket (harga + isi) untuk halaman beli di app driver.
export async function getPackageInfo() {
  return { price: await getPrice(), items: PACKAGE_ITEMS };
}

function serialize(o: {
  id: string; amount: unknown; status: string; referenceId: string; paymentUrl: string | null;
  adminNote: string | null; paidAt: Date | null; createdAt: Date; updatedAt: Date;
  driver?: { user: { name: string; phone: string } } | null;
}) {
  return {
    id: o.id,
    amount: Number(o.amount),
    status: o.status,
    referenceId: o.referenceId,
    paymentUrl: o.status === 'PENDING_PAYMENT' ? o.paymentUrl : null, // hanya relevan saat menunggu bayar
    adminNote: o.adminNote,
    items: PACKAGE_ITEMS,
    paidAt: o.paidAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    driverName: o.driver?.user.name,
    driverPhone: o.driver?.user.phone,
  };
}

// Driver beli paket → buat order + link pembayaran iPaymu.
export async function createOrder(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId }, include: { user: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);

  // Cegah dobel order aktif (belum selesai/bayar) — satu proses dulu.
  const active = await prisma.driverPackageOrder.findFirst({
    where: { driverId: driver.id, status: { notIn: [DriverPackageStatus.COMPLETED] } },
  });
  if (active) {
    // Order lama masih "Verifikasi pembayaran" tapi sudah lewat 24 jam → anggap batal, hapus,
    // lalu izinkan beli lagi. (Selain itu = ada proses berjalan, tolak.)
    const staleUnpaid =
      active.status === DriverPackageStatus.PENDING_PAYMENT &&
      active.createdAt.getTime() < Date.now() - PACKAGE_EXPIRY_MS;
    if (staleUnpaid) {
      await prisma.driverPackageOrder.delete({ where: { id: active.id } });
    } else {
      throw new AppError('Masih ada pesanan paket yang berjalan', 400);
    }
  }

  const amount = await getPrice();
  if (amount <= 0) throw new AppError('Paket belum tersedia. Hubungi admin.', 400);

  const referenceId = `PKG-${driver.id.slice(0, 8)}-${Date.now()}`;
  const order = await prisma.driverPackageOrder.create({
    data: { driverId: driver.id, amount, referenceId, status: DriverPackageStatus.PENDING_PAYMENT },
  });

  const pay = await createRedirectPayment({
    amount,
    referenceId,
    productName: 'Paket Mitra Driver (Jacket + Helm SNI)',
    buyerName: driver.user.name,
    buyerEmail: driver.user.email,
    buyerPhone: driver.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/package/done`,
    cancelUrl: `${PUBLIC_URL}/package/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/package/callback`,
  });
  if (!pay) {
    await prisma.driverPackageOrder.delete({ where: { id: order.id } });
    throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  }
  await prisma.driverPackageOrder.update({
    where: { id: order.id },
    data: { paymentUrl: pay.url, ipaymuSessionId: pay.sessionId },
  });
  return { referenceId, paymentUrl: pay.url, amount, items: PACKAGE_ITEMS };
}

// Riwayat/status pesanan paket milik driver.
export async function listMyOrders(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId }, select: { id: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  const orders = await prisma.driverPackageOrder.findMany({
    where: { driverId: driver.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return orders.map(serialize);
}

// Lanjutkan pembayaran order yang belum dibayar: buat link iPaymu BARU (link lama bisa
// kedaluwarsa/terpakai bila driver sempat keluar). Pakai referenceId order yang sama
// supaya callback tetap cocok.
export async function repayOrder(driverUserId: string, orderId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId }, include: { user: true } });
  if (!driver) throw new AppError('Driver tidak ditemukan', 404);
  const order = await prisma.driverPackageOrder.findFirst({ where: { id: orderId, driverId: driver.id } });
  if (!order) throw new AppError('Pesanan tidak ditemukan', 404);
  if (order.status !== DriverPackageStatus.PENDING_PAYMENT) throw new AppError('Pesanan ini sudah dibayar/diproses', 400);

  const pay = await createRedirectPayment({
    amount: Number(order.amount),
    referenceId: order.referenceId,
    productName: 'Paket Mitra Driver (Jacket + Helm SNI)',
    buyerName: driver.user.name,
    buyerEmail: driver.user.email,
    buyerPhone: driver.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/package/done`,
    cancelUrl: `${PUBLIC_URL}/package/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/package/callback`,
  });
  if (!pay) throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  await prisma.driverPackageOrder.update({ where: { id: order.id }, data: { paymentUrl: pay.url, ipaymuSessionId: pay.sessionId } });
  return { paymentUrl: pay.url };
}

// Callback iPaymu: pembayaran sukses → PENDING_PAYMENT ke VERIFIED (Terverifikasi).
export async function handleCallback(params: Record<string, unknown>): Promise<void> {
  const refId = String(params.reference_id ?? params.referenceId ?? '');
  if (!refId.startsWith('PKG-')) return;
  const order = await prisma.driverPackageOrder.findUnique({ where: { referenceId: refId } });
  if (!order || order.status !== DriverPackageStatus.PENDING_PAYMENT) return;

  const code = String(params.status_code ?? '');
  const status = String(params.status ?? '').toLowerCase();
  const trxId = String(params.trx_id ?? params.sid ?? '');
  const success = code === '1' || ['berhasil', 'success', 'paid'].some((s) => status.includes(s));
  if (!success) {
    if (trxId) await prisma.driverPackageOrder.updateMany({ where: { id: order.id, status: DriverPackageStatus.PENDING_PAYMENT }, data: { ipaymuTrxId: trxId } });
    return;
  }
  await prisma.driverPackageOrder.updateMany({
    where: { id: order.id, status: DriverPackageStatus.PENDING_PAYMENT },
    data: { status: DriverPackageStatus.VERIFIED, paidAt: new Date(), ipaymuTrxId: trxId },
  });
}

// Batalkan otomatis paket yang belum dibayar > 24 jam (link iPaymu sudah mati).
// Dihapus supaya driver bisa memesan ulang & status "Verifikasi pembayaran" hilang.
export function startPackageExpirySweeper(): void {
  const runOnce = async () => {
    try {
      const cutoff = new Date(Date.now() - PACKAGE_EXPIRY_MS);
      const res = await prisma.driverPackageOrder.deleteMany({
        where: { status: DriverPackageStatus.PENDING_PAYMENT, createdAt: { lt: cutoff } },
      });
      if (res.count) console.log(`[package-expiry] batal ${res.count} paket belum dibayar > 24 jam`);
    } catch (err) {
      console.error('[package-expiry] sweep gagal', err);
    }
  };
  runOnce();
  setInterval(runOnce, 30 * 60 * 1000); // tiap 30 menit
}

// ===== Admin =====
export async function listOrders() {
  const orders = await prisma.driverPackageOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    include: { driver: { include: { user: { select: { name: true, phone: true } } } } },
  });
  return orders.map(serialize);
}

export async function updateOrder(id: string, patch: { status?: string; adminNote?: string }) {
  const data: { status?: DriverPackageStatus; adminNote?: string } = {};
  if (patch.status !== undefined) {
    if (!STATUS_FLOW.includes(patch.status as DriverPackageStatus)) throw new AppError('Status tidak valid', 400);
    data.status = patch.status as DriverPackageStatus;
  }
  if (patch.adminNote !== undefined) data.adminNote = patch.adminNote;
  if (!Object.keys(data).length) throw new AppError('Tidak ada perubahan', 400);
  await prisma.driverPackageOrder.update({ where: { id }, data });
  return { ok: true };
}

export async function getAdminInfo() {
  return { price: await getPrice(), items: PACKAGE_ITEMS };
}

export async function setPrice(price: number) {
  if (!Number.isFinite(price) || price < 0) throw new AppError('Harga tidak valid', 400);
  await settingsService.updateSettings({ driver_package_price: String(Math.round(price)) });
  return { price: Math.round(price) };
}
