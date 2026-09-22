import { DriverStatus, OrderStatus, ServiceType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { calculateDistance } from '../utils/fare';
import { sendToToken } from '../utils/fcm';
import { AppError } from '../middleware/error.middleware';
import * as settingsService from './settings.service';

const BOOST_STEP_KM = 2;
// Jeda antar-boost (anti-spam): setelah boost, tombol terkunci 15 menit. Radius hasil
// boost tetap akumulatif & berlaku selama order masih mencari driver.
const BOOST_COOLDOWN_MS = 15 * 60 * 1000;

const SERVICE_LABEL: Record<string, string> = {
  RIDE: 'Kilat Ride',
  CAR: 'Kilat Car',
  SEND: 'Kilat Send',
  FOOD: 'Kilat Food',
};

// Broadcast notif ke SEMUA driver yang memenuhi syarat dalam radius (sekali per order).
// Beda dari notifyDriver (yang cuma ke 1 kandidat tawaran): ini biar semua driver terdekat
// tahu ada order baru & bisa ambil dari "Daftar Order". "sesuai radius yang ada".
async function notifyNearbyDrivers(
  order: { id: string; pickupLat: number; pickupLng: number; serviceType: ServiceType; totalFare: unknown },
  radiusKm: number,
  locFreshMin: number
) {
  if (notifiedNearby.has(order.id)) return;
  notifiedNearby.add(order.id);
  const since = new Date(Date.now() - locFreshMin * 60 * 1000);
  const drivers = await prisma.driver.findMany({
    where: {
      status: DriverStatus.ONLINE,
      isApproved: true,
      latitude: { not: null },
      longitude: { not: null },
      lastLocationAt: { gte: since },
      fcmToken: { not: null },
    },
    select: { latitude: true, longitude: true, serviceType: true, enabledServices: true, fcmToken: true },
  });
  const fare = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(order.totalFare));
  const targets = drivers.filter((d) => {
    const services = d.enabledServices ? d.enabledServices.split(',').map((x) => x.trim()) : [d.serviceType];
    if (!services.includes(order.serviceType)) return false;
    return calculateDistance(order.pickupLat, order.pickupLng, d.latitude!, d.longitude!) <= radiusKm;
  });
  await Promise.all(
    targets.map((d) =>
      sendToToken(
        d.fcmToken!,
        { title: 'Order baru di dekatmu! 🛵', body: `${SERVICE_LABEL[order.serviceType] ?? order.serviceType} · ${fare} · buka Daftar Order` },
        { type: 'order_available', orderId: order.id }
      ).catch(() => {})
    )
  );
}

// Push notif ke driver yang sedang ditawari (biar tahu walau app di background).
async function notifyDriver(driverId: string, orderId: string) {
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { fcmToken: true } });
  if (!driver?.fcmToken) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { totalFare: true, serviceType: true },
  });
  if (!order) return;
  const fare = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(order.totalFare));
  await sendToToken(
    driver.fcmToken,
    { title: 'Order baru masuk! 🛵', body: `${SERVICE_LABEL[order.serviceType] ?? order.serviceType} · ${fare}` },
    { type: 'order_offer', orderId }
  );
}

// Auto-dispatch: saat order dibuat, tawarkan ke driver terbaik dalam radius satu
// per satu dengan timeout. Prioritas = jarak + rating + pengalaman layanan itu.
// State disimpan in-memory (single instance). ponytail: pindah ke Redis kalau
// backend jalan multi-proses/instance.

type Offer = {
  orderId: string;
  candidates: string[]; // driver.id, urut terbaik → terburuk
  index: number;
  driverId: string; // yang sedang ditawari
  expiresAt: number;
};

const offersByOrder = new Map<string, Offer>();
const offerByDriverId = new Map<string, string>(); // driver.id → orderId
// Cooldown: driver yang MENOLAK sebuah order tidak ditawari order itu lagi sampai TS ini.
// Mencegah spam re-offer ke driver yang sama (mis. saat cuma 1 driver online).
const declineCooldown = new Map<string, Map<string, number>>(); // orderId → (driverId → untilMs)
const DECLINE_COOLDOWN_MS = 3 * 60 * 1000;
// Order yang sudah di-broadcast notif ke driver terdekat (sekali per order, anti-spam).
// ponytail: in-memory; entry order yang batal hilang saat restart — leak-nya sepele.
const notifiedNearby = new Set<string>();

// Order bisa ditawarkan ke driver: RIDE/CAR/SEND saat PENDING; FOOD HANYA setelah
// merchant terima (MERCHANT_ACCEPTED) — jangan tawarkan FOOD yang masih PENDING.
function isOfferable(status: OrderStatus, serviceType: ServiceType): boolean {
  if (serviceType === ServiceType.FOOD) return status === OrderStatus.MERCHANT_ACCEPTED;
  return status === OrderStatus.PENDING;
}

async function config() {
  const s = await settingsService.getSettings();
  return {
    radiusKm: parseFloat(s.dispatch_radius_km || '5') || 5,
    timeoutSec: parseInt(s.dispatch_timeout_sec || '15', 10) || 15,
    locFreshMin: parseInt(s.dispatch_location_fresh_min || '10', 10) || 10,
  };
}

async function buildCandidates(
  orderId: string,
  order: { pickupLat: number; pickupLng: number; serviceType: ServiceType },
  cfg: { radiusKm: number; locFreshMin: number }
): Promise<string[]> {
  const declined = declineCooldown.get(orderId);
  const since = new Date(Date.now() - cfg.locFreshMin * 60 * 1000);
  // available = ONLINE (bukan BUSY), approved, punya lokasi segar
  const drivers = await prisma.driver.findMany({
    where: {
      status: DriverStatus.ONLINE,
      isApproved: true,
      latitude: { not: null },
      longitude: { not: null },
      lastLocationAt: { gte: since },
    },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      rating: true,
      serviceType: true,
      enabledServices: true,
    },
  });

  const scored: { id: string; score: number }[] = [];
  for (const d of drivers) {
    // Driver baru menolak order ini → lewati sampai cooldown habis.
    const until = declined?.get(d.id);
    if (until && Date.now() < until) continue;

    const services = d.enabledServices
      ? d.enabledServices.split(',').map((x) => x.trim())
      : [d.serviceType];
    if (!services.includes(order.serviceType)) continue; // layanan tidak dicentang

    const dist = calculateDistance(order.pickupLat, order.pickupLng, d.latitude!, d.longitude!);
    if (dist > cfg.radiusKm) continue; // di luar radius

    // pengalaman = jumlah order layanan ini yang pernah diselesaikan
    const exp = await prisma.order.count({
      where: { driverId: d.id, status: OrderStatus.COMPLETED, serviceType: order.serviceType },
    });

    const distScore = 1 - dist / cfg.radiusKm; // makin dekat makin tinggi
    const ratingScore = Math.min(Number(d.rating) || 0, 5) / 5;
    const expScore = Math.min(exp, 50) / 50; // di-cap di 50 order
    const score = 0.5 * distScore + 0.3 * ratingScore + 0.2 * expScore;
    scored.push({ id: d.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.id);
}

function clearOffer(offer: Offer) {
  offersByOrder.delete(offer.orderId);
  if (offerByDriverId.get(offer.driverId) === offer.orderId) {
    offerByDriverId.delete(offer.driverId);
  }
}

async function advance(orderId: string) {
  const offer = offersByOrder.get(orderId);
  if (!offer) return;
  offerByDriverId.delete(offer.driverId);
  offer.index += 1;
  if (offer.index >= offer.candidates.length) {
    offersByOrder.delete(orderId); // habis → order tetap PENDING (fallback grab list)
    return;
  }
  const cfg = await config();
  offer.driverId = offer.candidates[offer.index];
  offer.expiresAt = Date.now() + cfg.timeoutSec * 1000;
  offerByDriverId.set(offer.driverId, orderId);
  notifyDriver(offer.driverId, orderId).catch(() => {});
}

export async function startDispatch(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
  if (!order || !isOfferable(order.status, order.serviceType) || order.driverId) return;
  // e-Wallet/Transfer (iPaymu): JANGAN tawarkan ke driver sampai pembayaran PAID.
  // Dispatch dipicu ulang dari callback iPaymu saat sudah lunas.
  // Order MANUAL dikecualikan: driver jalan dulu, link bayar dibagikan setelah harga final.
  if (order.paymentMethod === PaymentMethod.EWALLET && order.payment?.status !== PaymentStatus.PAID && !order.isManual) return;
  const cfg = await config();
  // Boost pencarian: radius akumulatif tetap berlaku selama order masih mencari driver
  // (boostExpiresAt kini dipakai sbg jeda tombol, bukan masa aktif radius).
  const boost = order.boostKm || 0;
  const radiusKm = cfg.radiusKm + boost;
  // Broadcast notif ke semua driver terdekat dalam radius (sekali per order).
  notifyNearbyDrivers(order, radiusKm, cfg.locFreshMin).catch(() => {});
  const candidates = await buildCandidates(
    orderId,
    { pickupLat: order.pickupLat, pickupLng: order.pickupLng, serviceType: order.serviceType },
    { ...cfg, radiusKm }
  );
  if (candidates.length === 0) return; // tak ada kandidat → biarkan PENDING
  offersByOrder.set(orderId, {
    orderId,
    candidates,
    index: 0,
    driverId: candidates[0],
    expiresAt: Date.now() + cfg.timeoutSec * 1000,
  });
  offerByDriverId.set(candidates[0], orderId);
  notifyDriver(candidates[0], orderId).catch(() => {});
}

// Boost pencarian driver: pelanggan/mitra klik → radius dispatch +2km (akumulatif).
// Anti-spam: setelah klik, tombol terkunci 15 menit (boostExpiresAt = batas jeda).
export async function boostOrder(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { userId: true } }, merchant: { select: { userId: true } } },
  });
  if (!order) throw new AppError('Pesanan tidak ditemukan', 404);
  const isOwner = order.customer.userId === userId || order.merchant?.userId === userId;
  if (!isOwner) throw new AppError('Tidak berwenang atas pesanan ini', 403);
  if (order.driverId) throw new AppError('Driver sudah ditemukan, tidak perlu boost', 400);
  if (!isOfferable(order.status, order.serviceType)) throw new AppError('Pesanan tidak sedang mencari driver', 400);
  // Masih dalam jeda → tolak (anti-spam). App juga menonaktifkan tombol, ini pengaman server.
  if (order.boostExpiresAt && order.boostExpiresAt.getTime() > Date.now()) {
    const secLeft = Math.ceil((order.boostExpiresAt.getTime() - Date.now()) / 1000);
    throw new AppError(`Tunggu ${Math.ceil(secLeft / 60)} menit lagi sebelum boost berikutnya.`, 429);
  }

  const newBoost = order.boostKm + BOOST_STEP_KM;
  const expiresAt = new Date(Date.now() + BOOST_COOLDOWN_MS);
  await prisma.order.update({ where: { id: orderId }, data: { boostKm: newBoost, boostExpiresAt: expiresAt } });

  // Bersihkan offer aktif agar startDispatch membangun ulang kandidat dgn radius lebih lebar.
  const off = offersByOrder.get(orderId);
  if (off) clearOffer(off);
  await startDispatch(orderId);

  const s = await settingsService.getSettings();
  const base = parseFloat(s.dispatch_radius_km || '5') || 5;
  return { boostKm: newBoost, baseRadiusKm: base, effectiveRadiusKm: base + newBoost, cooldownUntil: expiresAt };
}

// Info boost order (untuk tampilan app): radius saat ini + status jeda (cooldown).
export async function getBoostInfo(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { select: { userId: true } }, merchant: { select: { userId: true } } },
  });
  if (!order) throw new AppError('Pesanan tidak ditemukan', 404);
  const isOwner = order.customer.userId === userId || order.merchant?.userId === userId;
  if (!isOwner) throw new AppError('Tidak berwenang atas pesanan ini', 403);
  const s = await settingsService.getSettings();
  const base = parseFloat(s.dispatch_radius_km || '5') || 5;
  const searching = !order.driverId && isOfferable(order.status, order.serviceType);
  const onCooldown = !!order.boostExpiresAt && order.boostExpiresAt.getTime() > Date.now();
  return {
    searching,                          // tampilkan kartu boost?
    canBoost: searching && !onCooldown, // tombol aktif?
    onCooldown,
    cooldownUntil: onCooldown ? order.boostExpiresAt : null,
    cooldownMinutes: Math.round(BOOST_COOLDOWN_MS / 60000),
    boostKm: order.boostKm,             // akumulatif, berlaku selama mencari driver
    baseRadiusKm: base,
    effectiveRadiusKm: base + order.boostKm,
    stepKm: BOOST_STEP_KM,
  };
}

// Tawarkan order ke SATU driver spesifik (admin pilih manual). Driver tetap konfirmasi via app.
export async function offerToDriver(orderId: string, driverId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.driverId || !isOfferable(order.status, order.serviceType)) return;
  const cfg = await config();
  offersByOrder.set(orderId, { orderId, candidates: [driverId], index: 0, driverId, expiresAt: Date.now() + cfg.timeoutSec * 1000 });
  offerByDriverId.set(driverId, orderId);
  notifyDriver(driverId, orderId).catch(() => {});
}

// Order yang sedang ditawarkan ke driver ini (untuk polling app). null jika tidak ada.
export async function getOfferForDriver(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId }, select: { id: true } });
  if (!driver) return null;
  const orderId = offerByDriverId.get(driver.id);
  if (!orderId) return null;
  const offer = offersByOrder.get(orderId);
  if (!offer || offer.driverId !== driver.id || Date.now() > offer.expiresAt) return null;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { include: { user: { select: { name: true, phone: true } } } },
      merchant: { select: { id: true, businessName: true, address: true, latitude: true, longitude: true } },
      items: true,
    },
  });
  if (!order || !isOfferable(order.status, order.serviceType) || order.driverId) {
    clearOffer(offer);
    return null;
  }
  (order as any).pickupCode = undefined; // jangan bocorkan kode pickup ke driver
  // Order manual: tampilkan nama/HP pelanggan asli (bukan akun placeholder).
  if (order.isManual && order.customer?.user) {
    order.customer.user.name = order.manualCustomerName ?? order.customer.user.name;
    order.customer.user.phone = order.manualCustomerPhone ?? order.customer.user.phone;
  }
  return { order, expiresInMs: offer.expiresAt - Date.now() };
}

export function onOrderTaken(orderId: string): void {
  const offer = offersByOrder.get(orderId);
  if (offer) clearOffer(offer);
  declineCooldown.delete(orderId); // sudah diambil → cooldown tak relevan
  notifiedNearby.delete(orderId);
}

export async function declineOffer(orderId: string, driverUserId: string): Promise<void> {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId }, select: { id: true } });
  if (!driver) return;
  // Catat penolakan → jangan tawari order ini ke driver tsb selama cooldown.
  const m = declineCooldown.get(orderId) ?? new Map<string, number>();
  m.set(driver.id, Date.now() + DECLINE_COOLDOWN_MS);
  declineCooldown.set(orderId, m);
  const offer = offersByOrder.get(orderId);
  if (offer && offer.driverId === driver.id) await advance(orderId);
}

// Lempar ke driver berikutnya saat timeout; bersihkan kalau order sudah diambil/batal.
export function startSweeper(): void {
  setInterval(async () => {
    const now = Date.now();
    for (const [orderId, offer] of offersByOrder) {
      if (now <= offer.expiresAt) continue;
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, driverId: true, serviceType: true },
      });
      if (!order || !isOfferable(order.status, order.serviceType) || order.driverId) {
        clearOffer(offer);
        continue;
      }
      await advance(orderId);
    }
  }, 3000);
}

// Re-dispatch: order yang bisa ditawarkan (PENDING ride/car/send, MERCHANT_ACCEPTED food)
// tapi belum ada driver & tanpa offer aktif → tawarkan lagi. Bikin tahan banting:
// order FOOD tak nyangkut selamanya kalau offer pertama meleset/expired.
export function startRedispatchSweeper(): void {
  setInterval(async () => {
    try {
      const now = Date.now();
      const orders = await prisma.order.findMany({
        where: {
          driverId: null,
          OR: [
            // RIDE/CAR/SEND siap ditawarkan saat PENDING.
            { serviceType: { not: ServiceType.FOOD }, status: OrderStatus.PENDING },
            // FOOD hanya setelah merchant TERIMA (bukan yang masih PENDING).
            { serviceType: ServiceType.FOOD, status: OrderStatus.MERCHANT_ACCEPTED },
          ],
        },
        select: { id: true },
      });
      const offerable = new Set(orders.map((o) => o.id));
      // Bersihkan offer untuk order yang SUDAH TAK offerable (batal/selesai/diambil)
      // supaya tak lagi ditawarkan & tak bikin driver nyangkut di modal basi.
      for (const [id, off] of offersByOrder) {
        if (!offerable.has(id)) clearOffer(off);
      }
      for (const o of orders) {
        const off = offersByOrder.get(o.id);
        if (off && now <= off.expiresAt) continue; // masih ada offer aktif → biarkan
        if (off) clearOffer(off); // offer basi/expired → bersihkan dulu
        await startDispatch(o.id); // aman: skip kalau tak ada kandidat / EWALLET belum bayar
      }
      // Prune cooldown untuk order yang sudah tak offerable (selesai/batal).
      for (const id of declineCooldown.keys()) {
        if (!offerable.has(id)) declineCooldown.delete(id);
      }
    } catch (err) {
      console.error('[redispatch] sweep failed', err);
    }
  }, 8000);
}
