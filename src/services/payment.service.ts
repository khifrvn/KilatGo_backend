import { PaymentMethod, PaymentStatus, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { createRedirectPayment } from '../utils/ipaymu';
import { startDispatch } from './dispatch.service';

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://api.kilatgo.com';

// Buat pembayaran order via iPaymu (redirect). referenceId disimpan di
// Payment.transactionId agar callback bisa mencocokkan.
export async function payOrderIpaymu(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, customer: { include: { user: true } } },
  });
  if (!order) throw new AppError('Order not found', 404);
  if (order.customer.userId !== userId) throw new AppError('Not authorized for this order', 403);
  if (order.payment?.status === PaymentStatus.PAID) throw new AppError('Order sudah dibayar', 400);

  const referenceId = `ORDER-${order.id.slice(0, 8)}-${Date.now()}`;
  await prisma.payment.upsert({
    where: { orderId: order.id },
    update: { status: PaymentStatus.PENDING, method: PaymentMethod.EWALLET, transactionId: referenceId },
    create: { orderId: order.id, amount: order.totalFare, method: PaymentMethod.EWALLET, status: PaymentStatus.PENDING, transactionId: referenceId },
  });

  const pay = await createRedirectPayment({
    amount: Number(order.totalFare),
    referenceId,
    productName: 'Pembayaran Order KilatGo',
    buyerName: order.customer.user.name,
    buyerEmail: order.customer.user.email,
    buyerPhone: order.customer.user.phone ?? '',
    returnUrl: `${PUBLIC_URL}/pay/done`,
    cancelUrl: `${PUBLIC_URL}/pay/cancel`,
    notifyUrl: `${PUBLIC_URL}/api/payments/ipaymu/callback`,
  });
  if (!pay) throw new AppError('Gagal membuat pembayaran. Cek konfigurasi iPaymu.', 502);
  return { paymentUrl: pay.url, referenceId, amount: Number(order.totalFare) };
}

export async function handleIpaymuCallback(params: Record<string, unknown>): Promise<void> {
  const refId = String(params.reference_id ?? params.referenceId ?? '');
  if (!refId) return;
  const payment = await prisma.payment.findFirst({ where: { transactionId: refId } });
  if (!payment || payment.status === PaymentStatus.PAID) return;
  const code = String(params.status_code ?? '');
  const status = String(params.status ?? '').toLowerCase();
  const success = code === '1' || status === 'berhasil' || status === 'success';
  // 'pending'/tanpa status → biarkan PENDING (belum final), jangan tandai FAILED.
  const failed = !success && (code === '-2' || code === '2' || code === '3' || status === 'gagal' || status === 'expired' || status === 'failed');
  if (!success && !failed) return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: success ? PaymentStatus.PAID : PaymentStatus.FAILED, paidAt: success ? new Date() : null },
  });

  // Pembayaran lunas → MULAI tawarkan order ke driver (tadinya ditahan).
  if (success) {
    startDispatch(payment.orderId).catch(() => {});
  }

  // Pembayaran gagal/expired → batalkan order e-Wallet yang masih ditahan (belum ada driver).
  // (Order dgn driver seharusnya tak mungkin di sini karena dispatch ditahan sampai PAID.)
  if (failed) {
    await prisma.order.updateMany({
      where: { id: payment.orderId, status: OrderStatus.PENDING, driverId: null },
      data: { status: OrderStatus.CANCELLED },
    });
  }
}

// Batalkan order e-Wallet yang ditinggal tanpa dibayar (iPaymu tak selalu kirim
// callback saat user kabur). Jalan berkala; order sudah > EXPIRY & belum PAID → CANCELLED.
export function startPaymentExpirySweeper(): void {
  const EXPIRY_MS = 15 * 60 * 1000; // ponytail: 15 menit; setel bila perlu
  const runOnce = async () => {
    try {
      const cutoff = new Date(Date.now() - EXPIRY_MS);
      const stale = await prisma.order.findMany({
        where: {
          paymentMethod: PaymentMethod.EWALLET,
          status: OrderStatus.PENDING,
          driverId: null,
          createdAt: { lt: cutoff },
          NOT: { payment: { status: PaymentStatus.PAID } }, // payment null / belum lunas
        },
        select: { id: true },
      });
      if (stale.length) {
        await prisma.order.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: { status: OrderStatus.CANCELLED },
        });
        console.log(`[payment-expiry] cancelled ${stale.length} unpaid e-Wallet order(s)`);
      }
    } catch (err) {
      console.error('[payment-expiry] sweep failed', err);
    }
  };
  setInterval(runOnce, 5 * 60 * 1000); // tiap 5 menit
}

export interface ProcessPaymentInput {
  orderId: string;
  method: PaymentMethod;
  userId: string;
}

export async function processPayment(input: ProcessPaymentInput) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { payment: true, customer: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  if (order.customer.userId !== input.userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  if (order.payment && order.payment.status === PaymentStatus.PAID) {
    throw new AppError('Order already paid', 400);
  }

  // Mock payment processing
  const mockTransactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  // For demo purposes, non-cash methods succeed 90% of the time
  const shouldSucceed = input.method === PaymentMethod.CASH || Math.random() > 0.1;

  if (!shouldSucceed) {
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.totalFare,
        method: input.method,
        status: PaymentStatus.FAILED,
        transactionId: mockTransactionId,
      },
    });

    throw new AppError('Payment processing failed', 400);
  }

  // Upsert payment record
  const payment = await prisma.payment.upsert({
    where: { orderId: order.id },
    update: {
      status: PaymentStatus.PAID,
      method: input.method,
      transactionId: mockTransactionId,
      paidAt: new Date(),
    },
    create: {
      orderId: order.id,
      amount: order.totalFare,
      method: input.method,
      status: PaymentStatus.PAID,
      transactionId: mockTransactionId,
      paidAt: new Date(),
    },
  });

  return payment;
}

export async function getPayment(paymentId: string, userId: string, userRole: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          customer: true,
          driver: true,
        },
      },
    },
  });

  if (!payment) {
    throw new AppError('Payment not found', 404);
  }

  if (userRole !== 'ADMIN' && payment.order.customer.userId !== userId) {
    if (payment.order.driver?.userId !== userId) {
      throw new AppError('Not authorized to view this payment', 403);
    }
  }

  return payment;
}

export async function listPayments(userId: string, userRole: string) {
  const where: any = {};

  if (userRole !== 'ADMIN') {
    where.order = {
      OR: [{ customer: { userId } }, { driver: { userId } }],
    };
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      order: {
        include: {
          customer: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
          driver: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return payments;
}

export async function getPaymentByOrder(orderId: string) {
  const payment = await prisma.payment.findUnique({
    where: { orderId },
    include: { order: true },
  });

  if (!payment) {
    throw new AppError('Payment not found for this order', 404);
  }

  return payment;
}
