import { OrderStatus, ServiceType, PaymentMethod, DriverStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { calculateDistance, calculateFare } from '../utils/fare';
import { createRedirectPayment } from '../utils/ipaymu';
import * as dispatchService from './dispatch.service';
import * as settingsService from './settings.service';

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://api.kilatgo.com';

// Pelanggan "placeholder" untuk order manual yang tidak dikaitkan ke akun.
// Order tetap punya customerId valid; nama/HP asli disimpan di kolom manual order.
let placeholderId: string | null = null;
async function getPlaceholderCustomerId(): Promise<string> {
  if (placeholderId) return placeholderId;
  const existing = await prisma.customer.findFirst({ where: { user: { email: 'manual-order@kilatgo.system' } } });
  if (existing) { placeholderId = existing.id; return placeholderId; }
  const user = await prisma.user.create({
    data: {
      email: 'manual-order@kilatgo.system',
      phone: 'MANUAL-ORDER-SYSTEM',
      name: 'Pelanggan Manual',
      password: 'x', // akun sistem, tak bisa login (bukan hash valid)
      role: 'CUSTOMER',
      status: 'ACTIVE',
      customer: { create: {} },
    },
    include: { customer: true },
  });
  placeholderId = user.customer!.id;
  return placeholderId;
}

// Hitung ongkir (pakai tarif SEND) + biaya layanan + total dari jarak toko→pelanggan.
async function computeFare(storeLat: number, storeLng: number, custLat: number, custLng: number, itemsTotal: number | null) {
  const settings = await settingsService.getSettings();
  const distanceKm = calculateDistance(storeLat, storeLng, custLat, custLng);
  const baseFare = calculateFare(distanceKm, 'SEND', settings);
  const serviceFee = Math.max(0, Math.round(parseFloat(settings.service_fee || '0') || 0));
  const items = itemsTotal ?? 0;
  const totalFare = baseFare + items + serviceFee;
  return { distanceKm, baseFare, serviceFee, totalFare };
}

export interface CreateManualOrderInput {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  custLat: number;
  custLng: number;
  storeLat: number;
  storeLng: number;
  items: string; // Pesanan pelanggan
  itemsTotal?: number | null; // Harga pesanan (null/undefined = belum diketahui)
  paymentMethod: 'CASH' | 'EWALLET' | 'BALANCE';
  linkedCustomerId?: string | null; // Customer.id (opsional; wajib untuk BALANCE & live tracking)
  notes?: string;
}

export async function createManualOrder(input: CreateManualOrderInput) {
  const name = input.customerName?.trim();
  const phone = input.customerPhone?.trim();
  if (!name) throw new AppError('Nama pelanggan wajib diisi', 400);
  if (!phone) throw new AppError('Nomor HP pelanggan wajib diisi', 400);
  if (!input.customerAddress?.trim()) throw new AppError('Alamat pelanggan wajib diisi', 400);
  for (const [k, v] of [['custLat', input.custLat], ['custLng', input.custLng], ['storeLat', input.storeLat], ['storeLng', input.storeLng]] as const) {
    if (!Number.isFinite(Number(v))) throw new AppError(`Titik koordinat ${k} tidak valid`, 400);
  }
  const method = input.paymentMethod;
  if (!['CASH', 'EWALLET', 'BALANCE'].includes(method)) throw new AppError('Sistem pembayaran tidak valid', 400);

  // Kaitkan pelanggan (opsional). BALANCE wajib dikaitkan (potong saldo akun tsb).
  let customerId: string;
  if (input.linkedCustomerId) {
    const linked = await prisma.customer.findUnique({ where: { id: input.linkedCustomerId } });
    if (!linked) throw new AppError('Pelanggan yang dikaitkan tidak ditemukan', 404);
    customerId = linked.id;
  } else {
    if (method === 'BALANCE') throw new AppError('Pembayaran Saldo KilatGo wajib mengaitkan akun pelanggan', 400);
    customerId = await getPlaceholderCustomerId();
  }

  const itemsTotal = input.itemsTotal != null && Number.isFinite(Number(input.itemsTotal)) ? Math.round(Number(input.itemsTotal)) : null;
  const { distanceKm, baseFare, serviceFee, totalFare } = await computeFare(input.storeLat, input.storeLng, input.custLat, input.custLng, itemsTotal);

  // Pesanan (belanja) disimpan terstruktur di manualItems; catatan pelanggan di notes.
  // App driver menampilkan keduanya terpisah (order manual).
  const items = input.items?.trim();
  const driverNotes = input.notes?.trim() || null;

  const order = await prisma.order.create({
    data: {
      customerId,
      serviceType: ServiceType.SEND, // order antar/titip; masuk dispatch driver SEND
      isManual: true,
      manualCustomerName: name,
      manualCustomerPhone: phone,
      manualItems: items || null,
      itemsKnown: itemsTotal != null,
      recipientName: name,
      recipientPhone: phone,
      pickupLat: input.storeLat, pickupLng: input.storeLng, pickupAddress: 'Toko (titik pengambilan)',
      dropoffLat: input.custLat, dropoffLng: input.custLng, dropoffAddress: input.customerAddress.trim(),
      distanceKm,
      baseFare,
      serviceFee,
      itemsTotal,
      totalFare,
      paymentMethod: method as PaymentMethod,
      notes: driverNotes,
      status: OrderStatus.PENDING,
    },
  });
  return getManualOrder(order.id);
}

function serialize(o: any) {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customerName: o.manualCustomerName,
    customerPhone: o.manualCustomerPhone,
    customerAddress: o.dropoffAddress,
    custLat: o.dropoffLat, custLng: o.dropoffLng,
    storeLat: o.pickupLat, storeLng: o.pickupLng,
    items: o.manualItems,
    itemsTotal: o.itemsTotal != null ? Number(o.itemsTotal) : null,
    itemsKnown: o.itemsKnown,
    baseFare: Number(o.baseFare),
    serviceFee: Number(o.serviceFee),
    totalFare: Number(o.totalFare),
    paymentMethod: o.paymentMethod,
    paymentUrl: o.paymentUrl,
    paymentPaid: o.payment?.status === 'PAID', // gateway lunas / transfer dikonfirmasi admin
    linked: o.customer?.user?.email && o.customer.user.email !== 'manual-order@kilatgo.system'
      ? { name: o.customer.user.name, email: o.customer.user.email, phone: o.customer.user.phone } : null,
    driver: o.driver ? { id: o.driver.id, name: o.driver.user.name, phone: o.driver.user.phone } : null,
    notes: o.notes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

export async function listManualOrders() {
  const orders = await prisma.order.findMany({
    where: { isManual: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
      driver: { include: { user: { select: { name: true, phone: true } } } },
      payment: { select: { status: true } },
    },
  });
  return orders.map(serialize);
}

export async function getManualOrder(id: string) {
  const o = await prisma.order.findFirst({
    where: { id, isManual: true },
    include: {
      customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
      driver: { include: { user: { select: { name: true, phone: true } } } },
      payment: { select: { status: true } },
    },
  });
  if (!o) throw new AppError('Order manual tidak ditemukan', 404);
  return serialize(o);
}

// Admin konfirmasi pembayaran diterima (link gateway lunas ATAU transfer manual masuk).
// Tandai Payment PAID → order boleh diselesaikan.
export async function confirmPayment(id: string) {
  const o = await prisma.order.findFirst({ where: { id, isManual: true }, include: { payment: true } });
  if (!o) throw new AppError('Order manual tidak ditemukan', 404);
  if (o.paymentMethod !== 'EWALLET') throw new AppError('Konfirmasi pembayaran hanya untuk metode Payment Gateway', 400);
  if (o.payment) {
    await prisma.payment.updateMany({ where: { orderId: id, status: { not: 'PAID' } }, data: { status: 'PAID', paidAt: new Date() } });
  } else {
    await prisma.payment.create({ data: { orderId: id, amount: o.totalFare, method: 'EWALLET', status: 'PAID', paidAt: new Date() } });
  }
  return getManualOrder(id);
}

// Update "Harga pesanan" setelah driver tahu harga di toko → hitung ulang total.
export async function updatePrice(id: string, itemsTotal: number) {
  const o = await prisma.order.findFirst({ where: { id, isManual: true } });
  if (!o) throw new AppError('Order manual tidak ditemukan', 404);
  if (o.status === OrderStatus.COMPLETED || o.status === OrderStatus.CANCELLED) throw new AppError('Order sudah selesai/dibatalkan', 400);
  const items = Math.round(Number(itemsTotal));
  if (!Number.isFinite(items) || items < 0) throw new AppError('Harga pesanan tidak valid', 400);
  const totalFare = Number(o.baseFare) + items + Number(o.serviceFee);
  await prisma.order.update({ where: { id }, data: { itemsTotal: items, itemsKnown: true, totalFare } });
  return getManualOrder(id);
}

// Buat/segarkan link pembayaran gateway (dibagikan ke WA pelanggan).
export async function generatePaymentLink(id: string) {
  const o = await prisma.order.findFirst({ where: { id, isManual: true }, include: { customer: { include: { user: true } } } });
  if (!o) throw new AppError('Order manual tidak ditemukan', 404);
  if (o.paymentMethod !== PaymentMethod.EWALLET) throw new AppError('Link bayar hanya untuk metode Payment Gateway', 400);
  if (!o.itemsKnown) throw new AppError('Isi harga pesanan dulu sebelum membuat link bayar', 400);
  const ref = `MORDER-${o.id.slice(0, 8)}-${Date.now()}`;
  const pay = await createRedirectPayment({
    amount: Number(o.totalFare),
    referenceId: ref,
    productName: 'Pesanan KilatGo (Order Manual)',
    buyerName: o.manualCustomerName || 'Pelanggan',
    buyerEmail: o.customer.user.email.includes('@kilatgo.system') ? 'noreply@kilatgo.com' : o.customer.user.email,
    buyerPhone: o.manualCustomerPhone || '',
    returnUrl: `${PUBLIC_URL}/order/done`,
    cancelUrl: `${PUBLIC_URL}/order/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/wallet/manual-order/callback`,
  });
  if (!pay) throw new AppError('Gagal membuat link. Cek konfigurasi iPaymu.', 502);
  await prisma.order.update({ where: { id }, data: { paymentUrl: pay.url, paymentRef: ref } });
  return getManualOrder(id);
}

// Admin pilih driver: 'auto' = dispatch terdekat; atau driverId spesifik (ditawarkan ke dia).
export async function dispatchOrder(id: string, opts: { driverId?: string; auto?: boolean }) {
  const o = await prisma.order.findFirst({ where: { id, isManual: true } });
  if (!o) throw new AppError('Order manual tidak ditemukan', 404);
  if (o.driverId) throw new AppError('Order sudah punya driver', 400);
  if (o.status !== OrderStatus.PENDING) throw new AppError('Order tidak bisa ditawarkan lagi', 400);
  if (opts.driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: opts.driverId } });
    if (!driver) throw new AppError('Driver tidak ditemukan', 404);
    if (driver.status !== DriverStatus.ONLINE) throw new AppError('Driver sedang tidak online', 400);
    await dispatchService.offerToDriver(id, opts.driverId);
  } else {
    await dispatchService.startDispatch(id);
  }
  return { ok: true };
}

// Callback iPaymu untuk link bayar order manual → tandai Payment PAID (visibilitas admin).
export async function handleCallback(params: Record<string, unknown>): Promise<void> {
  const refId = String(params.reference_id ?? params.referenceId ?? '');
  if (!refId.startsWith('MORDER-')) return;
  const order = await prisma.order.findFirst({ where: { paymentRef: refId, isManual: true }, include: { payment: true } });
  if (!order) return;
  const code = String(params.status_code ?? '');
  const status = String(params.status ?? '').toLowerCase();
  const success = code === '1' || ['berhasil', 'success', 'paid'].some((s) => status.includes(s));
  if (!success) return;
  const trxId = String(params.trx_id ?? params.sid ?? '');
  if (order.payment) {
    await prisma.payment.updateMany({ where: { orderId: order.id, status: { not: 'PAID' } }, data: { status: 'PAID', paidAt: new Date(), transactionId: trxId } });
  } else {
    await prisma.payment.create({ data: { orderId: order.id, amount: order.totalFare, method: PaymentMethod.EWALLET, status: 'PAID', paidAt: new Date(), transactionId: trxId } });
  }
}

// Daftar driver online (untuk pilih manual).
export async function listOnlineDrivers() {
  const drivers = await prisma.driver.findMany({
    where: { status: DriverStatus.ONLINE, isApproved: true },
    select: { id: true, rating: true, latitude: true, longitude: true, user: { select: { name: true, phone: true } } },
    orderBy: { rating: 'desc' },
    take: 100,
  });
  return drivers.map((d) => ({ id: d.id, name: d.user.name, phone: d.user.phone, rating: Number(d.rating) }));
}

// Cari pelanggan terdaftar (untuk "Kaitkan pelanggan"). Wajib punya akun.
export async function searchCustomers(q: string) {
  const query = (q || '').trim();
  if (query.length < 2) return [];
  const customers = await prisma.customer.findMany({
    where: {
      user: {
        email: { not: 'manual-order@kilatgo.system' },
        OR: [{ name: { contains: query } }, { email: { contains: query } }, { phone: { contains: query } }],
      },
    },
    select: { id: true, user: { select: { name: true, email: true, phone: true } } },
    take: 10,
  });
  return customers.map((c) => ({ id: c.id, name: c.user.name, email: c.user.email, phone: c.user.phone }));
}
