import { OrderStatus, UserRole, DriverStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { calculateDistance, calculateFare } from '../utils/fare';

export interface CreateOrderInput {
  customerId: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  paymentMethod: any;
  notes?: string;
}

export async function createOrder(input: CreateOrderInput) {
  const customer = await prisma.customer.findUnique({
    where: { userId: input.customerId },
  });

  if (!customer) {
    throw new AppError('Customer profile not found', 404);
  }

  const distanceKm = calculateDistance(
    input.pickupLat,
    input.pickupLng,
    input.dropoffLat,
    input.dropoffLng
  );

  const fare = calculateFare(distanceKm);

  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      pickupAddress: input.pickupAddress,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      dropoffAddress: input.dropoffAddress,
      distanceKm,
      baseFare: fare,
      totalFare: fare,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      status: OrderStatus.PENDING,
    },
    include: {
      customer: {
        include: {
          user: {
            select: { id: true, name: true, phone: true },
          },
        },
      },
    },
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

  if (order.status !== OrderStatus.PENDING) {
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

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      driverId: driver.id,
      status: OrderStatus.ACCEPTED,
    },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      driver: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  // Set driver as busy
  await prisma.driver.update({
    where: { id: driver.id },
    data: { status: DriverStatus.BUSY },
  });

  return updatedOrder;
}

export async function updateOrderStatus(
  orderId: string,
  userId: string,
  userRole: UserRole,
  status: OrderStatus
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { driver: true, customer: true },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  // Authorization checks
  if (userRole === UserRole.DRIVER && order.driver?.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  if (userRole === UserRole.CUSTOMER && order.customer.userId !== userId) {
    throw new AppError('Not authorized for this order', 403);
  }

  // Validate status transitions
  const validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
    [OrderStatus.ACCEPTED]: [OrderStatus.DRIVER_ARRIVED, OrderStatus.CANCELLED],
    [OrderStatus.DRIVER_ARRIVED]: [OrderStatus.ON_RIDE, OrderStatus.CANCELLED],
    [OrderStatus.ON_RIDE]: [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  if (!validTransitions[order.status].includes(status)) {
    throw new AppError(
      `Cannot transition order from ${order.status} to ${status}`,
      400
    );
  }

  const updateData: any = { status };

  if (status === OrderStatus.COMPLETED) {
    updateData.completedAt = new Date();
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      driver: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      payment: true,
    },
  });

  // If completed, create payment record and free driver
  if (status === OrderStatus.COMPLETED) {
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

    if (order.driverId) {
      await prisma.driver.update({
        where: { id: order.driverId },
        data: { status: DriverStatus.ONLINE },
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
  return updateOrderStatus(orderId, userId, userRole, OrderStatus.CANCELLED);
}

export async function getOrder(orderId: string, userId: string, userRole: UserRole) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      driver: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      payment: true,
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

  return order;
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
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      driver: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders;
}

export async function findAvailableOrders() {
  const orders = await prisma.order.findMany({
    where: { status: OrderStatus.PENDING, driverId: null },
    include: {
      customer: {
        include: {
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return orders;
}
