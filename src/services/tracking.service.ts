import { DriverStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export async function updateDriverLocation(
  userId: string,
  latitude: number,
  longitude: number
) {
  const driver = await prisma.driver.findUnique({
    where: { userId },
  });

  if (!driver) {
    throw new AppError('Driver profile not found', 404);
  }

  const updatedDriver = await prisma.driver.update({
    where: { userId },
    data: {
      latitude,
      longitude,
      lastLocationAt: new Date(),
    },
  });

  return updatedDriver;
}

export async function getDriverLocation(userId: string) {
  const driver = await prisma.driver.findUnique({
    where: { userId },
    select: {
      id: true,
      latitude: true,
      longitude: true,
      lastLocationAt: true,
      status: true,
      user: {
        select: { id: true, name: true, phone: true },
      },
    },
  });

  if (!driver) {
    throw new AppError('Driver profile not found', 404);
  }

  return driver;
}

export async function setDriverOnline(userId: string) {
  const driver = await prisma.driver.update({
    where: { userId },
    data: { status: DriverStatus.ONLINE },
  });

  return driver;
}

export async function setDriverOffline(userId: string) {
  const driver = await prisma.driver.update({
    where: { userId },
    data: { status: DriverStatus.OFFLINE },
  });

  return driver;
}

export async function getOrderTracking(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      driver: {
        select: {
          id: true,
          latitude: true,
          longitude: true,
          lastLocationAt: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      },
      trackingLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!order) {
    throw new AppError('Order not found', 404);
  }

  return order;
}
