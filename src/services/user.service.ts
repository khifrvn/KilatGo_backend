import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      customer: true,
      driver: true,
      admin: true,
    },
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const { password, ...profile } = user;
  return profile;
}

export async function updateProfile(userId: string, data: { name?: string; phone?: string }) {
  if (data.phone) {
    const existing = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        NOT: { id: userId },
      },
    });

    if (existing) {
      throw new AppError('Phone number already in use', 409);
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

export async function updateDriverProfile(
  userId: string,
  data: { vehicleType?: string; vehiclePlate?: string; licenseNumber?: string }
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driver: true },
  });

  if (!user || user.role !== UserRole.DRIVER || !user.driver) {
    throw new AppError('Driver profile not found', 404);
  }

  const updatedDriver = await prisma.driver.update({
    where: { userId },
    data,
    include: { user: true },
  });

  return updatedDriver;
}

export async function listDrivers(options: { status?: UserStatus; isApproved?: boolean } = {}) {
  const where: any = {};

  if (options.status) {
    where.user = { status: options.status };
  }

  if (options.isApproved !== undefined) {
    where.isApproved = options.isApproved;
  }

  const drivers = await prisma.driver.findMany({
    where,
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

export async function listCustomers() {
  const customers = await prisma.customer.findMany({
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

  return customers;
}

export async function approveDriver(driverId: string, isApproved: boolean) {
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: { user: true },
  });

  if (!driver) {
    throw new AppError('Driver not found', 404);
  }

  const updatedDriver = await prisma.driver.update({
    where: { id: driverId },
    data: {
      isApproved,
      user: {
        update: {
          status: isApproved ? UserStatus.ACTIVE : UserStatus.PENDING,
        },
      },
    },
    include: { user: true },
  });

  return updatedDriver;
}

export async function listAllUsers(role?: UserRole) {
  const where = role ? { role } : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return users;
}
