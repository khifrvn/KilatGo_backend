import { OrderStatus, UserRole, DriverStatus, PaymentStatus, ServiceType, WalletKind, PaymentMethod, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import * as settingsService from './settings.service';
import { AppError } from '../middleware/error.middleware';
import { calculateDistance, calculateFare, packageSurcharge } from '../utils/fare';
import { customerCancelDecision, settingNum } from '../utils/orderTiming';
import * as voucherService from './voucher.service';
import { sendToToken } from '../utils/fcm';

// Pesan push ke customer per status order.
const CUSTOMER_PUSH: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  [OrderStatus.ACCEPTED]: { title: 'Driver ditemukan 🎉', body: 'Driver sedang menuju lokasimu.' },
  [OrderStatus.DRIVER_ARRIVED]: { title: 'Driver tiba 📍', body: 'Driver sudah sampai di lokasi jemput.' },
  [OrderStatus.ON_RIDE]: { title: 'Pesanan dalam perjalanan 🛵', body: 'Pesananmu sedang menuju tujuan.' },
  [OrderStatus.COMPLETED]: { title: 'Pesanan selesai ✅', body: 'Terima kasih! Beri rating untuk drivermu.' },
  [OrderStatus.CANCELLED]: { title: 'Pesanan dibatalkan', body: 'Pesananmu telah dibatalkan.' },
};

// Kirim push + simpan notifikasi in-app ke customer sesuai status (fire-and-forget).
// override: pesan khusus di luar tabel status (mis. peringatan "belum dapat driver").
async function pushOrderToCustomer(
  orderId: string,
  status: OrderStatus,
  override?: { title: string; body: string }
): Promise<void> {
  const msg = override ?? CUSTOMER_PUSH[status];
  if (!msg) return;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customer: { select: { userId: true, user: { select: { fcmToken: true } } } } },
  });
  const userId = o?.customer.userId;
  if (!userId) return;
  const token = o?.customer.user.fcmToken;
  // Kirim push DULU & tanpa menunggu (biar tak tertunda tulisan DB / caller).
  if (token) sendToToken(token, msg, { type: 'order_status', orderId, status }).catch(() => {});
  // Simpan ke daftar Notifikasi in-app (async; tetap tercatat walau push/token gagal).
  prisma.notification
    .create({ data: { userId, title: msg.title, body: msg.body, type: 'order_status' } })
    .catch(() => {});
}

export interface CreateOrderItemInput {
  menuId?: string;
  name: string;
  price: number;
  quantity: number;
  note?: string;
}

export interface CreateOrderInput {
  customerId: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  paymentMethod: any;
  serviceType?: ServiceType;
  voucherCode?: string;
  notes?: string;
  distanceKm?: number; // jarak jalan (OSRM) dari client; divalidasi server
  merchantId?: string; // FOOD
  items?: CreateOrderItemInput[]; // FOOD
  packageType?: string; // SEND: DOCUMENT|SMALL|MEDIUM|LARGE
  packageContents?: string; // SEND: isi paket (opsional; kosong = disembunyikan customer)
  recipientName?: string; // SEND: nama penerima
  recipientPhone?: string; // SEND: no telp penerima (WhatsApp)
}

export async function createOrder(input: CreateOrderInput) {
  const customer = await prisma.customer.findUnique({
    where: { userId: input.customerId },
  });

  if (!customer) {
    throw new AppError('Customer profile not found', 404);
  }

  // Profil wajib lengkap: alamat domisili harus diisi sebelum bisa memesan layanan.
  if (!customer.address?.trim()) {
    throw new AppError('Lengkapi alamat di profil kamu dulu sebelum memesan layanan.', 400);
  }

  const serviceType = input.serviceType ?? ServiceType.RIDE;

  // Pickup: RIDE/CAR/SEND pakai titik dari customer; FOOD diturunkan dari lokasi warung.
  let merchantId: string | null = null;
  let pickup = { lat: input.pickupLat ?? 0, lng: input.pickupLng ?? 0, address: input.pickupAddress ?? '' };
  let itemsTotal = 0;
  let orderItems: { menuId: string | null; name: string; price: number; quantity: number; note: string | null }[] = [];
  let pickupCode: string | null = null;

  if (serviceType === ServiceType.FOOD) {
    if (!input.merchantId || !input.items?.length) {
      throw new AppError('merchantId dan items wajib untuk order FOOD', 400);
    }
    const merchant = await prisma.merchant.findUnique({ where: { id: input.merchantId } });
    if (!merchant || !merchant.isApproved) throw new AppError('Warung tidak ditemukan', 404);
    if (!merchant.isOpen) throw new AppError('Warung sedang tutup', 400);
    if (merchant.latitude == null || merchant.longitude == null) {
      throw new AppError('Lokasi warung belum diatur', 400);
    }
    merchantId = merchant.id;
    pickup = { lat: merchant.latitude, lng: merchant.longitude, address: merchant.address || merchant.businessName };
    orderItems = input.items.map((it) => ({
      menuId: it.menuId ?? null,
      name: it.name,
      price: Math.round(it.price),
      quantity: it.quantity,
      note: it.note ?? null,
    }));
    itemsTotal = orderItems.reduce((s, it) => s + it.price * it.quantity, 0);
    pickupCode = String(Math.floor(1000 + Math.random() * 9000)); // 4 digit utk driver
  } else if (input.pickupLat == null || input.pickupLng == null || !input.pickupAddress) {
    throw new AppError('pickup wajib untuk layanan ini', 400);
  }

  const settings = await settingsService.getSettings();
  // Jarak jalan (OSRM) dari client dipakai bila wajar (>= garis lurus, <= 3x garis lurus),
  // supaya tarif cocok dengan estimasi yang dilihat customer. Jika tidak → garis lurus.
  const straightKm = calculateDistance(pickup.lat, pickup.lng, input.dropoffLat, input.dropoffLng);
  const roadKm = typeof input.distanceKm === 'number' && Number.isFinite(input.distanceKm) ? input.distanceKm : undefined;
  const distanceKm = roadKm != null && roadKm >= straightKm && roadKm <= straightKm * 3 ? roadKm : straightKm;
  // SEND: ongkir + biaya paket berdasarkan tipe/ukuran. Tarif dari settings admin.
  const surcharge = serviceType === ServiceType.SEND ? packageSurcharge(input.packageType) : 0;
  const deliveryFare = calculateFare(distanceKm, serviceType, settings) + surcharge;
  // Biaya layanan flat (Rp) — dibebankan ke customer, bukan bagian pendapatan driver.
  const serviceFee = Math.max(0, Math.round(parseFloat(settings.service_fee || '0') || 0));

  // Apply voucher server-side (authoritative — client discount is only a preview).
  // Voucher tak valid → error jelas ke user (bukan diam-diam diabaikan).
  let discount = 0;
  let voucherCode: string | null = null;
  let voucherId: string | null = null;
  if (input.voucherCode) {
    const r = await voucherService.validateForOrder(customer.id, input.voucherCode, serviceType, deliveryFare, itemsTotal);
    discount = r.discount;
    voucherCode = r.voucher.code;
    voucherId = r.voucher.id;
  }
  // FOOD: total = ongkir + harga makanan − diskon + biaya layanan. Lainnya: ongkir − diskon + biaya layanan.
  const totalFare = Math.max(0, deliveryFare + itemsTotal - discount + serviceFee);
  const isBalance = String(input.paymentMethod) === 'BALANCE';

  // Bayar pakai Saldo KilatGo → potong saldo ATOMIK bersama pembuatan order.
  const order = await prisma.$transaction(async (tx) => {
    if (isBalance) {
      const debited = await tx.customer.updateMany({
        where: { id: customer.id, balance: { gte: totalFare } },
        data: { balance: { decrement: totalFare } },
      });
      if (debited.count === 0) throw new AppError('Saldo KilatGo tidak cukup', 400);
    }
    const created = await tx.order.create({
      data: {
        customerId: customer.id,
        merchantId,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupAddress: pickup.address,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        dropoffAddress: input.dropoffAddress,
        distanceKm,
        serviceType,
        baseFare: deliveryFare,
        serviceFee,
        discount,
        voucherCode,
        itemsTotal: serviceType === ServiceType.FOOD ? itemsTotal : null,
        pickupCode,
        packageType: serviceType === ServiceType.SEND ? (input.packageType ?? null) : null,
        packageContents: serviceType === ServiceType.SEND ? (input.packageContents?.trim() || null) : null,
        recipientName: serviceType === ServiceType.SEND ? (input.recipientName?.trim() || null) : null,
        recipientPhone: serviceType === ServiceType.SEND ? (input.recipientPhone?.trim() || null) : null,
        totalFare,
        paymentMethod: input.paymentMethod,
        notes: input.notes,
        status: OrderStatus.PENDING,
        ...(orderItems.length ? { items: { create: orderItems } } : {}),
      },
      include: {
        customer: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } },
        items: true,
        merchant: { select: { id: true, businessName: true, address: true, latitude: true, longitude: true } },
      },
    });
    // ponytail: kuota dicek sebelum tx; increment di sini. Balapan bisa lewat sedikit dari kuota — ok utk promo.
    if (voucherId) await voucherService.redeemInTx(tx, voucherId, customer.id, created.id, discount, serviceType);
    return created;
  });

  return order;
}

export async function assignDriver(orderId: string, driverUserId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // FOOD ditawarkan setelah merchant terima (MERCHANT_ACCEPTED); lainnya saat PENDING.
  if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.MERCHANT_ACCEPTED) {
    throw new AppError('Order is no longer available', 400);
  }

  const driver = await prisma.driver.findUnique({
    where: { userId: driverUserId },
  });

  if (!driver) {
    throw new AppError('Driver profile not found', 404);
  }

  if (!driver.isApproved) {
    throw new AppError('Driver is not approved yet', 403);
  }

  if (driver.status !== DriverStatus.ONLINE) {
    throw new AppError('Driver must be online to accept orders', 400);
  }

  // ATOMIK: hanya assign kalau order MASIH offerable & belum ada driver. Menutup race
  // di mana order dibatalkan/diambil driver lain antara pengecekan status & update.
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      driverId: null,
      // FOOD hanya bisa diterima setelah merchant TERIMA (MERCHANT_ACCEPTED); lainnya saat PENDING.
      OR: [
        { serviceType: { not: ServiceType.FOOD }, status: OrderStatus.PENDING },
        { serviceType: ServiceType.FOOD, status: OrderStatus.MERCHANT_ACCEPTED },
      ],
    },
    data: {
      driverId: driver.id,
      status: OrderStatus.ACCEPTED,
      acceptedAt: new Date(),
      driverAcceptLat: driver.latitude,
      driverAcceptLng: driver.longitude,
    },
  });
  if (claimed.count === 0) {
    throw new AppError('Order is no longer available', 400);
  }

  const updatedOrder = await prisma.order.findUnique({
    where: { id: orderId },
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

  // Set driver as busy
  await prisma.driver.update({
    where: { id: driver.id },
    data: { status: DriverStatus.BUSY },
  });

  await pushOrderToCustomer(orderId, OrderStatus.ACCEPTED);

  return stripPickupCode(updatedOrder);
}

export async function updateOrderStatus(
  orderId: string,
  userId: string,
  userRole: UserRole,
  status: OrderStatus,
  // adminOverride: admin membetulkan order nyangkut dari CMS — transisi lebih longgar &
  // syarat bukti foto/kode pickup dilewati, TAPI efek uang (komisi/pendapatan/refund)
  // tetap jalan lewat jalur yang sama supaya tak ada order selesai tanpa settlement.
  opts?: { proofPhoto?: string; signaturePhoto?: string; adminOverride?: boolean; cancelReason?: string }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { driver: true, customer: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  const isAdmin = userRole === UserRole.ADMIN && opts?.adminOverride === true;

  // Authorization checks
  if (userRole === UserRole.DRIVER && order.driver?.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  if (userRole === UserRole.CUSTOMER && order.customer.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  // Validate status transitions
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.MERCHANT_ACCEPTED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DRIVER_ARRIVED, OrderStatus.CANCELLED],
    [OrderStatus.DRIVER_ARRIVED]: [OrderStatus.ON_RIDE, OrderStatus.CANCELLED],
    [OrderStatus.ON_RIDE]: [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };
  // Admin: boleh lompat maju & batalkan dari status manapun (kecuali yang sudah final).
  const adminTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.MERCHANT_ACCEPTED, OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.MERCHANT_ACCEPTED]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DRIVER_ARRIVED, OrderStatus.ON_RIDE, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.DRIVER_ARRIVED]: [OrderStatus.ON_RIDE, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.ON_RIDE]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  const allowed = isAdmin ? adminTransitions[order.status] : validTransitions[order.status];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot transition order from ${order.status} to ${status}`,
      400
    );
  }

  // Order MANUAL bayar gateway: JANGAN boleh selesai sebelum pembayaran dikonfirmasi
  // (customer bayar via link → callback iPaymu, ATAU admin konfirmasi transfer diterima).
  // Kalau tidak, saldo masuk ke dompet driver padahal uang customer belum diterima → rugi.
  if (status === OrderStatus.COMPLETED && order.isManual && order.paymentMethod === PaymentMethod.EWALLET) {
    const pay = await prisma.payment.findUnique({ where: { orderId }, select: { status: true } });
    if (pay?.status !== PaymentStatus.PAID) {
      throw new AppError('Pembayaran belum dikonfirmasi. Konfirmasi pembayaran (link gateway lunas atau transfer diterima) dulu di panel admin.', 400);
    }
  }

  const isFood = order.serviceType === ServiceType.FOOD;
  const isSend = order.serviceType === ServiceType.SEND;
  // FOOD: pickup lewat verifikasi kode. SEND: pickup lewat foto barang. (admin dilewati)
  if (!isAdmin && order.status === OrderStatus.DRIVER_ARRIVED && status === OrderStatus.ON_RIDE) {
    if (isFood) throw new AppError('Gunakan verifikasi kode pickup untuk order makanan', 400);
    if (isSend) throw new AppError('Unggah foto barang untuk menjemput paket', 400);
  }
  // FOOD & SEND: penyelesaian butuh bukti foto sampai. (admin dilewati)
  if (!isAdmin && (isFood || isSend) && status === OrderStatus.COMPLETED && !opts?.proofPhoto) {
    throw new AppError('Bukti foto wajib untuk menyelesaikan order', 400);
  }

  const updateData: any = { status };

  if (opts?.proofPhoto) {
    updateData.proofPhoto = opts.proofPhoto;
  }
  if (opts?.signaturePhoto) {
    updateData.signaturePhoto = opts.signaturePhoto;
  }

  if (status === OrderStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }
  if (status === OrderStatus.CANCELLED) {
    updateData.cancelledAt = new Date();
    if (opts?.cancelReason?.trim()) updateData.cancellationReason = opts.cancelReason.trim();
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
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
      payment: true,
    },
  });

  // Order dibayar Saldo KilatGo lalu dibatalkan → kembalikan saldo ke customer.
  // Order manual BALANCE belum dipotong di awal (potong saat selesai) → jangan refund.
  if (status === OrderStatus.CANCELLED && order.paymentMethod === PaymentMethod.BALANCE && !order.isManual) {
    await prisma.customer.update({
      where: { id: order.customerId },
      data: { balance: { increment: Number(order.totalFare) } },
    });
  }

  // Order batal padahal sudah ada driver → bebaskan driver (BUSY → ONLINE) supaya bisa
  // terima order lagi. Guard status BUSY: jangan paksa driver OFFLINE jadi online.
  if (status === OrderStatus.CANCELLED && order.driverId) {
    await prisma.driver.updateMany({
      where: { id: order.driverId, status: DriverStatus.BUSY },
      data: { status: DriverStatus.ONLINE },
    });
  }

  // Push ke customer sesuai status baru (tidak memblokir alur bila gagal).
  await pushOrderToCustomer(orderId, status);

  // If completed, create payment record and free driver
  if (status === OrderStatus.COMPLETED) {
    // Order e-Wallet sudah punya Payment (dibuat saat bayar iPaymu) → JANGAN create
    // lagi (orderId unik). Hanya buat untuk CASH/BALANCE yang belum punya record.
    if (!updatedOrder.payment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalFare,
          method: order.paymentMethod,
          status:
            order.paymentMethod === 'CASH'
              ? PaymentStatus.PENDING
              : PaymentStatus.PAID,
          paidAt: order.paymentMethod === 'CASH' ? null : new Date(),
        },
      });
    }

    const settings = await settingsService.getSettings();

    if (order.driverId) {
      const commissionPct = parseFloat(settings.commission_percent || '0') || 0;
      // Pendapatan driver = ongkir; untuk order MANUAL driver menalangi harga barang → ikut
      // masuk pendapatan (reimburse). Komisi selalu dihitung dari ongkir saja.
      // Normal: earningBase = ongkir (totalFare − serviceFee − itemsTotal[FOOD→merchant]).
      // Manual: earningBase = ongkir + harga barang (totalFare − serviceFee); komisi atas ongkir.
      const earningBase = order.isManual
        ? Number(order.totalFare) - Number(order.serviceFee)
        : Number(order.totalFare) - Number(order.serviceFee) - Number(order.itemsTotal ?? 0);
      const commissionBase = order.isManual ? Number(order.baseFare) : earningBase;
      const commission = Math.round((commissionBase * commissionPct) / 100);
      const isCash = order.paymentMethod === 'CASH';

      const drv = await prisma.driver.findUnique({
        where: { id: order.driverId },
        select: { creditBalance: true, earningsBalance: true },
      });
      const newCredit = Number(drv!.creditBalance) - commission;
      const newEarnings = Number(drv!.earningsBalance) + (isCash ? 0 : earningBase);

      await prisma.$transaction([
        prisma.driver.update({
          where: { id: order.driverId },
          data: {
            status: DriverStatus.ONLINE,
            totalRides: { increment: 1 },
            creditBalance: newCredit,
            earningsBalance: newEarnings,
          },
        }),
        // Komisi selalu dipotong dari Dompet Kredit
        prisma.walletTransaction.create({
          data: {
            driverId: order.driverId,
            wallet: WalletKind.CREDIT,
            type: 'COMMISSION',
            amount: -commission,
            balanceAfter: newCredit,
            ref: order.id,
            note: 'Komisi order selesai',
          },
        }),
        // Non-tunai → nominal masuk Dompet Driver. Tunai → tidak (uang cash di tangan driver).
        ...(isCash
          ? []
          : [
              prisma.walletTransaction.create({
                data: {
                  driverId: order.driverId,
                  wallet: WalletKind.EARNINGS,
                  type: 'ORDER_EARNING',
                  amount: earningBase,
                  balanceAfter: newEarnings,
                  ref: order.id,
                  note: order.isManual ? 'Pendapatan order manual (non-tunai)' : 'Pendapatan order (non-tunai)',
                },
              }),
            ]),
        // Order manual bayar Saldo KilatGo → potong saldo pelanggan yang dikaitkan.
        ...(order.isManual && order.paymentMethod === PaymentMethod.BALANCE
          ? [prisma.customer.update({ where: { id: order.customerId }, data: { balance: { decrement: Number(order.totalFare) } } })]
          : []),
      ]);
    }

    // FOOD: kredit saldo merchant = harga makanan − komisi KilatFood (platform).
    // Platform menalangi ke merchant; rekonsiliasi uang COD dari driver via dompet driver.
    if (order.serviceType === ServiceType.FOOD && order.merchantId && order.itemsTotal) {
      const foodPct = parseFloat(settings.food_commission_percent || '0') || 0;
      const merchantNet = Math.round(Number(order.itemsTotal) * (1 - foodPct / 100));
      await prisma.merchant.update({
        where: { id: order.merchantId },
        data: { balance: { increment: merchantNet } },
      });
    }
  }

  return updatedOrder;
}

export async function cancelOrder(
  orderId: string,
  userId: string,
  userRole: UserRole,
  reason?: string
) {
  // Aturan pembatalan customer (batas waktu dari pengaturan admin):
  // - <= order_cancel_grace_sec sejak memesan → boleh batal bebas (jendela "cooldown").
  // - Mencari warung/driver setelah jendela itu → belum bisa dibatalkan…
  // - …kecuali sudah dispatch_no_driver_warn_min menit tanpa driver → boleh batal lagi.
  // - Dapat driver (ACCEPTED) → boleh dibatalkan setelah 2 menit, DAN hanya bila
  //   driver belum jalan / tidak merespon (posisi belum bergerak / lokasi basi).
  // - Driver sudah tiba / perjalanan berjalan → tidak bisa dibatalkan.
  if (userRole === UserRole.CUSTOMER) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { userId: true } },
        driver: { select: { latitude: true, longitude: true, lastLocationAt: true } },
      },
    });
    if (!order) throw new AppError('Order not found', 404);
    if (order.customer.userId !== userId) throw new AppError('Not authorized for this order', 403);

    const s = await settingsService.getSettings();
    const decision = customerCancelDecision({
      status: order.status,
      ageSec: (Date.now() - order.createdAt.getTime()) / 1000,
      hasDriver: !!order.driverId,
      graceSec: settingNum(s.order_cancel_grace_sec, 30),
      warnMin: settingNum(s.dispatch_no_driver_warn_min, 10),
    });
    if (decision.kind === 'block') throw new AppError(decision.message, 400);
    if (decision.kind === 'defer' && (order.status === OrderStatus.DRIVER_ARRIVED || order.status === OrderStatus.ON_RIDE)) {
      throw new AppError('Driver sudah di lokasi / perjalanan berjalan, tidak bisa dibatalkan.', 400);
    }
    if (decision.kind === 'defer' && order.status === OrderStatus.ACCEPTED) {
      const acceptedMs = order.acceptedAt?.getTime() ?? Date.now();
      const elapsedSec = (Date.now() - acceptedMs) / 1000;
      if (elapsedSec < 120) {
        throw new AppError(`Bisa dibatalkan 2 menit setelah driver ditemukan. Tunggu ${Math.ceil(120 - elapsedSec)} detik lagi.`, 400);
      }
      // Driver aktif menuju lokasi (lokasi baru < 90 dtk & sudah bergerak > ~80 m) → tolak.
      const loc = order.driver?.lastLocationAt;
      const fresh = !!loc && Date.now() - loc.getTime() < 90_000;
      let moved = false;
      if (order.driverAcceptLat != null && order.driverAcceptLng != null && order.driver?.latitude != null && order.driver?.longitude != null) {
        moved = calculateDistance(order.driverAcceptLat, order.driverAcceptLng, order.driver.latitude, order.driver.longitude) >= 0.08;
      }
      if (fresh && moved) {
        throw new AppError('Driver sedang menuju lokasimu, tidak bisa dibatalkan.', 400);
      }
    }
  }
  return updateOrderStatus(orderId, userId, userRole, OrderStatus.CANCELLED, { cancelReason: reason });
}

// FOOD langkah 7–8: driver sampai resto (DRIVER_ARRIVED), merchant sebutkan kode,
// driver ketik kode → PICKED_UP (ON_RIDE). Kode TIDAK pernah dikirim ke driver.
export async function verifyPickupCode(orderId: string, driverUserId: string, code: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { driver: true } });
  if (!order) throw new AppError('Order not found', 404);
  if (order.driver?.userId !== driverUserId) throw new AppError('Not authorized for this order', 403);
  if (order.serviceType !== ServiceType.FOOD) throw new AppError('Bukan order makanan', 400);
  if (order.status !== OrderStatus.DRIVER_ARRIVED) throw new AppError('Order belum siap dijemput', 400);
  if (!order.pickupCode || order.pickupCode !== String(code).trim()) {
    throw new AppError('Kode pickup salah', 400);
  }
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.ON_RIDE },
    include: { customer: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } }, items: true },
  });
  await pushOrderToCustomer(orderId, OrderStatus.ON_RIDE);
  return stripPickupCode(updated);
}

// FOOD/SEND langkah akhir: driver antar sampai + unggah bukti foto → COMPLETED.
export async function completeWithProof(orderId: string, driverUserId: string, proofPhoto: string, signaturePhoto?: string) {
  return updateOrderStatus(orderId, driverUserId, UserRole.DRIVER, OrderStatus.COMPLETED, {
    proofPhoto,
    ...(signaturePhoto ? { signaturePhoto } : {}),
  });
}

// SEND langkah 3: kurir foto barang saat jemput → PICKED UP (ON_RIDE).
export async function pickupWithPhoto(orderId: string, driverUserId: string, pickupPhoto: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { driver: true } });
  if (!order) throw new AppError('Order not found', 404);
  if (order.driver?.userId !== driverUserId) throw new AppError('Not authorized for this order', 403);
  if (order.serviceType !== ServiceType.SEND) throw new AppError('Bukan order KilatSend', 400);
  if (order.status !== OrderStatus.DRIVER_ARRIVED) throw new AppError('Order belum siap dijemput', 400);
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.ON_RIDE, pickupPhoto },
    include: { customer: { include: { user: { select: { id: true, name: true, phone: true, avatar: true } } } } },
  });
  await pushOrderToCustomer(orderId, OrderStatus.ON_RIDE);
  return updated;
}

// Rating dua arah (customer↔driver). Hanya order selesai; update agregat target.
// Opsional: customer beri tip (dari Saldo KilatGo) yang masuk ke Dompet driver.
export async function rateOrder(orderId: string, userId: string, userRole: UserRole, stars: number, comment?: string, tip = 0, target?: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: true, driver: true } });
  if (!order) throw new AppError('Order not found', 404);
  if (order.status !== OrderStatus.COMPLETED) throw new AppError('Hanya order selesai yang bisa dinilai', 400);
  const isCustomer = userRole === UserRole.CUSTOMER && order.customer.userId === userId;
  const isDriver = userRole === UserRole.DRIVER && order.driver?.userId === userId;
  if (!isCustomer && !isDriver) throw new AppError('Not authorized for this order', 403);

  const byRole = isCustomer ? 'CUSTOMER' : 'DRIVER';
  // target = entitas yang dinilai. Customer bisa nilai DRIVER atau MERCHANT (FOOD).
  // Driver hanya menilai CUSTOMER.
  const rateMerchant = isCustomer && target === 'MERCHANT' && !!order.merchantId;
  const tgt = isDriver ? 'CUSTOMER' : rateMerchant ? 'MERCHANT' : 'DRIVER';
  const s = Math.max(1, Math.min(5, Math.round(stars)));
  const t = Math.max(0, Math.round(tip || 0));

  // Tip hanya sekali (tidak double saat re-rating), dari customer→driver, order punya driver.
  const existing = await prisma.rating.findUnique({ where: { orderId_byRole_target: { orderId, byRole, target: tgt } }, select: { tip: true } });
  const applyTip = t > 0 && isCustomer && tgt === 'DRIVER' && !!order.driverId && Number(existing?.tip ?? 0) === 0;

  await prisma.$transaction(async (tx) => {
    if (applyTip) {
      const debited = await tx.customer.updateMany({
        where: { id: order.customerId, balance: { gte: t } },
        data: { balance: { decrement: t } },
      });
      if (debited.count === 0) throw new AppError('Saldo KilatGo tidak cukup untuk tip', 400);
      const drv = await tx.driver.update({
        where: { id: order.driverId! },
        data: { earningsBalance: { increment: t } },
        select: { earningsBalance: true },
      });
      await tx.walletTransaction.create({
        data: {
          driverId: order.driverId!,
          wallet: WalletKind.EARNINGS,
          type: 'TIP',
          amount: t,
          balanceAfter: Number(drv.earningsBalance),
          ref: orderId,
          note: 'Tip dari pelanggan',
        },
      });
    }
    await tx.rating.upsert({
      where: { orderId_byRole_target: { orderId, byRole, target: tgt } },
      create: { orderId, byRole, target: tgt, stars: s, comment: comment ?? null, tip: applyTip ? t : 0 },
      update: { stars: s, comment: comment ?? null, ...(applyTip ? { tip: t } : {}) },
    });
  });

  // Notif ke driver saat dapat tip (setelah transaksi sukses).
  if (applyTip && order.driver?.fcmToken) {
    const tipRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(t);
    sendToToken(
      order.driver.fcmToken,
      { title: 'Kamu dapat tip! 💰', body: `Pelanggan memberi tip ${tipRp}. Sudah masuk ke saldo penghasilanmu.` },
      { type: 'tip', orderId }
    ).catch(() => {});
  }

  // Recompute rata-rata rating target dari semua order-nya.
  if (rateMerchant && order.merchantId) {
    const rs = await prisma.rating.findMany({ where: { byRole: 'CUSTOMER', target: 'MERCHANT', order: { merchantId: order.merchantId } }, select: { stars: true } });
    if (rs.length) {
      await prisma.merchant.update({
        where: { id: order.merchantId },
        data: { rating: rs.reduce((a, r) => a + r.stars, 0) / rs.length, totalRatings: rs.length },
      });
    }
  } else if (isCustomer && order.driverId) {
    const rs = await prisma.rating.findMany({ where: { byRole: 'CUSTOMER', target: 'DRIVER', order: { driverId: order.driverId } }, select: { stars: true } });
    if (rs.length) await prisma.driver.update({ where: { id: order.driverId }, data: { rating: rs.reduce((a, r) => a + r.stars, 0) / rs.length } });
  } else if (isDriver) {
    const rs = await prisma.rating.findMany({ where: { byRole: 'DRIVER', target: 'CUSTOMER', order: { customerId: order.customerId } }, select: { stars: true } });
    if (rs.length) {
      await prisma.customer.update({
        where: { id: order.customerId },
        data: { rating: rs.reduce((a, r) => a + r.stars, 0) / rs.length, totalRatings: rs.length },
      });
    }
  }
  return { orderId, byRole, target: tgt, stars: s };
}

// Order yang sudah dikirimi peringatan "belum dapat driver" (sekali per order, anti-spam).
// ponytail: in-memory; kalau backend restart peringatannya bisa terkirim dua kali — sepele.
const warnedNoDriver = new Set<string>();

// Batalkan order yang lewat batas waktu, ATOMIK (hanya bila kondisi where masih benar).
// Termasuk refund saldo & push ke customer. Mengembalikan jumlah yang benar-benar dibatalkan.
async function cancelStaleOrders(where: Prisma.OrderWhereInput, reason: string): Promise<number> {
  const stale = await prisma.order.findMany({
    where,
    select: { id: true, paymentMethod: true, customerId: true, totalFare: true, isManual: true },
  });
  let n = 0;
  for (const o of stale) {
    const res = await prisma.order.updateMany({
      where: { ...where, id: o.id },
      data: { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: reason },
    });
    if (res.count === 0) continue;
    n++;
    // Kembalikan saldo bila dibayar pakai Saldo KilatGo (order manual belum dipotong di awal).
    if (o.paymentMethod === PaymentMethod.BALANCE && !o.isManual) {
      await prisma.customer
        .update({ where: { id: o.customerId }, data: { balance: { increment: Number(o.totalFare) } } })
        .catch(() => {});
    }
    warnedNoDriver.delete(o.id);
    await pushOrderToCustomer(o.id, OrderStatus.CANCELLED, {
      title: 'Pesanan dibatalkan',
      body: reason,
    }).catch(() => {});
  }
  return n;
}

// Sweeper batas waktu pesanan (semua ambang dari pengaturan admin, dihitung sejak createdAt):
//   1. FOOD masih PENDING > merchant_confirm_min           → batal (warung tak konfirmasi).
//   2. tanpa driver >= dispatch_no_driver_warn_min          → notif "belum dapat driver nih".
//   3. tanpa driver > dispatch_no_driver_min                → batal (tak ada driver).
export async function cancelUnassignedStaleOrders(): Promise<void> {
  const s = await settingsService.getSettings();
  const confirmMin = settingNum(s.merchant_confirm_min, 5);
  const warnMin = settingNum(s.dispatch_no_driver_warn_min, 10);
  const cancelMin = settingNum(s.dispatch_no_driver_min, 15);
  const ago = (min: number) => new Date(Date.now() - min * 60 * 1000);

  // 1. Warung tidak mengonfirmasi pesanan makanan. Order e-Wallet yang BELUM lunas
  //    dikecualikan — itu menunggu pembayaran customer, bukan salah warung (tetap
  //    kena batas akhir no-driver di langkah 3).
  const noConfirm = await cancelStaleOrders(
    {
      serviceType: ServiceType.FOOD,
      status: OrderStatus.PENDING,
      driverId: null,
      createdAt: { lt: ago(confirmMin) },
      OR: [{ paymentMethod: { not: PaymentMethod.EWALLET } }, { payment: { status: PaymentStatus.PAID } }],
    },
    'Warung tidak mengonfirmasi pesanan dalam batas waktu.'
  );

  // 2. Peringatan: sudah lama mencari, driver belum ada. Tombol batal & boost muncul di app.
  const searching = await prisma.order.findMany({
    where: {
      driverId: null,
      status: { in: [OrderStatus.PENDING, OrderStatus.MERCHANT_ACCEPTED] },
      createdAt: { lt: ago(warnMin), gte: ago(cancelMin) },
    },
    select: { id: true },
  });
  for (const o of searching) {
    if (warnedNoDriver.has(o.id)) continue;
    warnedNoDriver.add(o.id);
    await pushOrderToCustomer(o.id, OrderStatus.PENDING, {
      title: 'Wah, belum dapat driver nih 😔',
      body: 'Mau lanjut menunggu? Kamu bisa perluas jangkauan driver (Boost) atau batalkan pesanan.',
    }).catch(() => {});
  }

  // Sudah dapat driver / selesai / batal → buang dari daftar warned biar tak numpuk.
  const stillSearching = new Set(searching.map((o) => o.id));
  for (const id of warnedNoDriver) if (!stillSearching.has(id)) warnedNoDriver.delete(id);

  // 3. Tetap tak ada driver sampai batas akhir → batalkan.
  const noDriver = await cancelStaleOrders(
    { driverId: null, status: { in: [OrderStatus.PENDING, OrderStatus.MERCHANT_ACCEPTED] }, createdAt: { lt: ago(cancelMin) } },
    'Tidak ada driver yang tersedia. Pesanan dibatalkan otomatis.'
  );

  if (noConfirm) console.log(`[stale-order] cancelled ${noConfirm} order(s) tanpa konfirmasi warung`);
  if (noDriver) console.log(`[stale-order] cancelled ${noDriver} order(s) tanpa driver`);
}

export function startStaleOrderSweeper(): void {
  setInterval(() => {
    cancelUnassignedStaleOrders().catch((e) => console.error('[stale-order] sweep failed', e));
    // 20 detik: batas warung bisa diset 1 menit, jangan sampai molor gara-gara sweeper lambat.
  }, 20 * 1000);
}

// pickupCode adalah rahasia merchant→customer; jangan bocor ke response driver.
function stripPickupCode<T>(o: T | null): T | null {
  if (o && typeof o === 'object' && 'pickupCode' in o) (o as any).pickupCode = undefined;
  return o;
}

// Order manual: tampilkan nama/HP pelanggan asli (bukan akun placeholder) ke driver/customer.
function applyManualDisplay<T>(o: T | null): T | null {
  const ord = o as any;
  if (ord?.isManual && ord.customer?.user) {
    ord.customer.user.name = ord.manualCustomerName ?? ord.customer.user.name;
    ord.customer.user.phone = ord.manualCustomerPhone ?? ord.customer.user.phone;
  }
  return o;
}

export async function getOrder(orderId: string, userId: string, userRole: UserRole) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
      // Hanya field driver yang aman untuk pelanggan (JANGAN kirim PIN/bank/NIK/saldo).
      driver: {
        select: {
          id: true,
          userId: true, // dipakai untuk cek otorisasi driver
          vehicleType: true,
          vehiclePlate: true,
          vehicleBrand: true,
          rating: true,
          selfiePhoto: true,
          latitude: true, // lokasi driver live (untuk tracking di peta)
          longitude: true,
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
      merchant: { select: { id: true, businessName: true, logo: true, address: true, phone: true, latitude: true, longitude: true } },
      items: true,
      payment: true,
      ratings: { where: { byRole: 'CUSTOMER' }, select: { stars: true, target: true, comment: true } },
      trackingLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (userRole === UserRole.CUSTOMER && order.customer.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  if (userRole === UserRole.DRIVER && order.driver?.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  // Driver tak boleh lihat kode pickup (harus diberi merchant lisan).
  if (userRole === UserRole.DRIVER) stripPickupCode(order);
  applyManualDisplay(order);

  // Badge chat: jumlah pesan belum dibaca dari pihak lawan.
  if (order.driverId && (userRole === UserRole.CUSTOMER || userRole === UserRole.DRIVER)) {
    (order as any).unreadCount = await prisma.message.count({
      where: { orderId, readAt: null, senderRole: { not: userRole } },
    });
  }
  return order;
}

// Nama file selfie driver order ini (foto profil), hanya untuk pihak order.
export async function getOrderDriverPhotoName(orderId: string, userId: string, userRole: UserRole): Promise<string> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { userId: true } },
      driver: { select: { userId: true, selfiePhoto: true } },
    },
  });
  if (!order) throw new AppError('Order not found', 404);
  const isCustomer = userRole === UserRole.CUSTOMER && order.customer.userId === userId;
  const isDriver = userRole === UserRole.DRIVER && order.driver?.userId === userId;
  if (!isCustomer && !isDriver) throw new AppError('Not authorized for this order', 403);
  const name = order.driver?.selfiePhoto;
  if (!name) throw new AppError('Foto driver tidak ada', 404);
  return name;
}

// Daftar percakapan customer↔driver. Aturan: chat driver hanya tampil 1 hari
// (order dibuat dalam 24 jam terakhir); yang lebih lama otomatis hilang dari daftar.
export async function listConversations(userId: string, userRole: UserRole = UserRole.CUSTOMER) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // riwayat chat terhapus 1x24 jam
  const isDriver = userRole === UserRole.DRIVER;

  const where: any = { driverId: { not: null }, createdAt: { gte: since }, messages: { some: {} } };
  if (isDriver) {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) throw new AppError('Driver profile not found', 404);
    where.driverId = driver.id;
  } else {
    const customer = await prisma.customer.findUnique({ where: { userId } });
    if (!customer) throw new AppError('Customer profile not found', 404);
    where.customerId = customer.id;
  }

  const peerRole = isDriver ? 'CUSTOMER' : 'DRIVER';
  const orders = await prisma.order.findMany({
    where,
    include: {
      driver: { select: { vehicleType: true, user: { select: { name: true } } } },
      customer: { select: { user: { select: { name: true } } } },
      messages: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return orders.map((o) => {
    const last = o.messages[0];
    const unread = o.messages.filter((m) => m.readAt === null && m.senderRole === peerRole).length;
    const peerName = isDriver ? (o.customer?.user.name ?? 'Pelanggan') : (o.driver?.user.name ?? 'Driver');
    return {
      orderId: o.id,
      serviceType: o.serviceType,
      peerName,
      driverName: peerName, // kompat: customer app lama membaca driverName
      vehicleType: o.driver?.vehicleType ?? null,
      lastMessage: last?.body ?? '',
      lastAt: last?.createdAt ?? o.createdAt,
      unread,
    };
  });
}

// ---- Chat customer↔driver ----

// Pastikan user adalah pihak order (customer atau driver) dan kembalikan perannya.
async function assertOrderParty(orderId: string, userId: string, userRole: UserRole) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { userId: true } }, driver: { select: { userId: true } } },
  });
  if (!order) throw new AppError('Order not found', 404);
  if (userRole === UserRole.CUSTOMER && order.customer.userId !== userId) throw new AppError('Not authorized for this order', 403);
  if (userRole === UserRole.DRIVER && order.driver?.userId !== userId) throw new AppError('Not authorized for this order', 403);
  return order;
}

export async function listMessages(orderId: string, userId: string, userRole: UserRole) {
  await assertOrderParty(orderId, userId, userRole);
  // Tandai pesan lawan sebagai terbaca saat dibuka.
  await prisma.message.updateMany({ where: { orderId, readAt: null, senderRole: { not: userRole } }, data: { readAt: new Date() } });
  return prisma.message.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
}

export async function sendMessage(orderId: string, userId: string, userRole: UserRole, body: string) {
  const order = await assertOrderParty(orderId, userId, userRole);
  if (!order.driverId) throw new AppError('Chat belum tersedia (driver belum ada)', 400);
  const text = body.trim();
  if (!text) throw new AppError('Pesan kosong', 400);
  return prisma.message.create({ data: { orderId, senderRole: userRole, body: text } });
}

export async function listOrders(userId: string, userRole: UserRole, status?: OrderStatus) {
  const where: any = {};

  if (status) {
    where.status = status;
  }

  if (userRole === UserRole.CUSTOMER) {
    const customer = await prisma.customer.findUnique({ where: { userId } });
    if (!customer) {
      throw new AppError('Customer profile not found', 404);
    }
    where.customerId = customer.id;
  } else if (userRole === UserRole.DRIVER) {
    const driver = await prisma.driver.findUnique({ where: { userId } });
    if (!driver) {
      throw new AppError('Driver profile not found', 404);
    }
    where.driverId = driver.id;
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
      driver: {
        select: {
          id: true,
          userId: true,
          vehicleType: true,
          vehiclePlate: true,
          vehicleBrand: true,
          rating: true,
          selfiePhoto: true,
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
      merchant: { select: { id: true, businessName: true, logo: true, latitude: true, longitude: true } },
      items: true,
      payment: true,
      ratings: { where: { byRole: 'CUSTOMER' }, select: { stars: true, target: true, comment: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (userRole === UserRole.DRIVER) orders.forEach((o) => stripPickupCode(o));
  return orders;
}

// Order berlangsung milik CUSTOMER (untuk banner "pesanan berlangsung" di beranda).
// Termasuk PENDING/MERCHANT_ACCEPTED agar order manual (dibuat admin) juga muncul.
export async function getCustomerActiveOrder(userId: string) {
  const customer = await prisma.customer.findUnique({ where: { userId }, select: { id: true } });
  if (!customer) return null;
  return prisma.order.findFirst({
    where: {
      customerId: customer.id,
      status: { in: [OrderStatus.PENDING, OrderStatus.MERCHANT_ACCEPTED, OrderStatus.ACCEPTED, OrderStatus.DRIVER_ARRIVED, OrderStatus.ON_RIDE] },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, serviceType: true, status: true, totalFare: true, createdAt: true },
  });
}

// Order yang sedang dikerjakan driver (ACCEPTED/DRIVER_ARRIVED/ON_RIDE) — untuk
// menampilkan & memulihkan layar perjalanan.
export async function getActiveOrder(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new AppError('Driver profile not found', 404);
  const active = await prisma.order.findFirst({
    where: {
      driverId: driver.id,
      status: { in: [OrderStatus.ACCEPTED, OrderStatus.DRIVER_ARRIVED, OrderStatus.ON_RIDE] },
    },
    include: {
      customer: { include: { user: { select: { name: true, phone: true } } } },
      merchant: { select: { id: true, businessName: true, address: true, phone: true, latitude: true, longitude: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return applyManualDisplay(stripPickupCode(active));
}

export async function findAvailableOrders(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) {
    throw new AppError('Driver profile not found', 404);
  }

  // Driver hanya lihat order untuk layanan yang AKTIF (enabledServices).
  // null = fallback ke serviceType terdaftar. Toggle di app memengaruhi ini.
  const services = driver.enabledServices
    ? driver.enabledServices.split(',').map((s) => s.trim()).filter(Boolean)
    : [driver.serviceType];

  // Order bisa diambil: RIDE/CAR/SEND saat PENDING; FOOD hanya setelah merchant TERIMA
  // (MERCHANT_ACCEPTED). Samakan dengan aturan dispatch (isOfferable).
  const nonFood = (services as ServiceType[]).filter((s) => s !== ServiceType.FOOD);
  const statusOr: Prisma.OrderWhereInput[] = [];
  if (nonFood.length) statusOr.push({ serviceType: { in: nonFood }, status: OrderStatus.PENDING });
  if (services.includes(ServiceType.FOOD)) statusOr.push({ serviceType: ServiceType.FOOD, status: OrderStatus.MERCHANT_ACCEPTED });
  if (statusOr.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: {
      driverId: null,
      AND: [
        { OR: statusOr },
        // Order e-Wallet/Transfer (iPaymu) DITAHAN dari dispatch sampai pembayaran PAID.
        // CASH (bayar di tempat) & BALANCE (sudah dipotong saat buat) langsung tampil.
        { OR: [{ paymentMethod: { not: PaymentMethod.EWALLET } }, { payment: { status: PaymentStatus.PAID } }] },
      ],
    },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true, avatar: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders;
}
