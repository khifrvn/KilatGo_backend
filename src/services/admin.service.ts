import { DriverStatus, OrderStatus, PaymentStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';

export async function getDashboardStats() {
  const [
    totalUsers,
    totalCustomers,
    totalDrivers,
    totalOrders,
    pendingOrders,
    completedOrders,
    cancelledOrders,
    pendingDrivers,
    totalEarnings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
    prisma.user.count({ where: { role: UserRole.DRIVER } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: OrderStatus.PENDING } }),
    prisma.order.count({ where: { status: OrderStatus.COMPLETED } }),
    prisma.order.count({ where: { status: OrderStatus.CANCELLED } }),
    prisma.driver.count({ where: { isApproved: false } }),
    prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID },
      _sum: { amount: true },
    }),
  ]);

  const [
    earningsTrend,
    ordersTrend,
    userGrowth,
    driverStatusDistribution,
    orderStatusDistribution,
    recentOrders,
    topDrivers,
  ] = await Promise.all([
    getEarningsTrend(14),
    getOrdersTrend(14),
    getUserGrowth(14),
    getDriverStatusDistribution(),
    getOrderStatusDistribution(),
    getRecentOrders(5),
    getTopDrivers(5),
  ]);

  return {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      drivers: totalDrivers,
    },
    orders: {
      total: totalOrders,
      pending: pendingOrders,
      completed: completedOrders,
      cancelled: cancelledOrders,
    },
    drivers: {
      pendingApproval: pendingDrivers,
    },
    earnings: totalEarnings._sum.amount || 0,
    earningsTrend,
    ordersTrend,
    userGrowth,
    driverStatusDistribution,
    orderStatusDistribution,
    recentOrders,
    topDrivers,
  };
}

async function getEarningsTrend(days: number) {
  const result: { date: string; amount: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const aggregation = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        paidAt: {
          gte: date,
          lt: nextDate,
        },
      },
      _sum: { amount: true },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      amount: Number(aggregation._sum.amount || 0),
    });
  }

  return result;
}

async function getOrdersTrend(days: number) {
  const result: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.order.count({
      where: {
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  return result;
}

async function getUserGrowth(days: number) {
  const result: { date: string; count: number }[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const count = await prisma.user.count({
      where: {
        createdAt: {
          gte: date,
          lt: nextDate,
        },
      },
    });

    result.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  return result;
}

async function getDriverStatusDistribution() {
  const [online, offline, busy] = await Promise.all([
    prisma.driver.count({ where: { status: DriverStatus.ONLINE } }),
    prisma.driver.count({ where: { status: DriverStatus.OFFLINE } }),
    prisma.driver.count({ where: { status: DriverStatus.BUSY } }),
  ]);

  return [
    { status: 'ONLINE', count: online, color: '#22c55e' },
    { status: 'OFFLINE', count: offline, color: '#64748b' },
    { status: 'BUSY', count: busy, color: '#facc15' },
  ];
}

async function getOrderStatusDistribution() {
  const statuses = [
    { status: OrderStatus.PENDING, color: '#facc15' },
    { status: OrderStatus.ACCEPTED, color: '#3b82f6' },
    { status: OrderStatus.DRIVER_ARRIVED, color: '#6366f1' },
    { status: OrderStatus.ON_RIDE, color: '#a855f7' },
    { status: OrderStatus.COMPLETED, color: '#22c55e' },
    { status: OrderStatus.CANCELLED, color: '#ef4444' },
  ];

  const result = await Promise.all(
    statuses.map(async (item) => ({
      status: item.status,
      count: await prisma.order.count({ where: { status: item.status } }),
      color: item.color,
    }))
  );

  return result;
}

async function getRecentOrders(limit: number) {
  const orders = await prisma.order.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
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

  return orders;
}

async function getTopDrivers(limit: number) {
  const drivers = await prisma.driver.findMany({
    where: { isApproved: true },
    take: limit,
    orderBy: { totalRides: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
    },
  });

  return drivers;
}

export async function getAllOrders(filters: {
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate);
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
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
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: orders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEarningsReport(filters: {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}) {
  const where: any = { status: PaymentStatus.PAID };

  if (filters.startDate || filters.endDate) {
    where.paidAt = {};
    if (filters.startDate) {
      where.paidAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.paidAt.lte = new Date(filters.endDate);
    }
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paidAt: 'asc' },
  });

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    total,
    count: payments.length,
    payments,
  };
}

export async function getPendingDrivers() {
  const drivers = await prisma.driver.findMany({
    where: { isApproved: false },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          status: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return drivers;
}

export async function suspendUser(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.SUSPENDED },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  return user;
}

export async function activateUser(userId: string) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.ACTIVE },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
    },
  });

  return user;
}
