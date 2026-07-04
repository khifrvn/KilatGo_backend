import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

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
