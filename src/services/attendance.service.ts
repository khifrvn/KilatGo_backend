import { AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CheckInInput {
  latitude: number;
  longitude: number;
  selfiePhoto?: string;
}

export async function checkIn(driverUserId: string, input: CheckInInput) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new AppError('Driver profile not found', 404);
  if (!driver.isApproved) throw new AppError('Driver belum di-approve', 403);

  // ponytail: face-match vs selfie KYC = stub. Isi matchScore/status dari vendor nanti.
  // Untuk sekarang selalu PRESENT; hook vendor menimpa matchScore & status.
  return prisma.attendance.create({
    data: {
      driverId: driver.id,
      latitude: input.latitude,
      longitude: input.longitude,
      selfiePhoto: input.selfiePhoto,
      matchScore: null,
      status: AttendanceStatus.PRESENT,
    },
  });
}

export async function listMyAttendance(driverUserId: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new AppError('Driver profile not found', 404);
  return prisma.attendance.findMany({ where: { driverId: driver.id }, orderBy: { checkedAt: 'desc' }, take: 100 });
}

export async function listAllAttendance(params: { date?: string } = {}) {
  const where: any = {};
  if (params.date) {
    const start = new Date(params.date + 'T00:00:00');
    const end = new Date(params.date + 'T23:59:59.999');
    where.checkedAt = { gte: start, lte: end };
  }
  return prisma.attendance.findMany({
    where,
    include: { driver: { include: { user: { select: { name: true, email: true, phone: true } } } } },
    orderBy: { checkedAt: 'desc' },
    take: 200,
  });
}
