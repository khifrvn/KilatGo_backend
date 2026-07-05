import { AttendanceStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { parseDescriptor, verifyFace } from '../utils/face';

export interface CheckInInput {
  latitude: number;
  longitude: number;
  selfiePhoto?: string;
  faceDescriptor?: string; // descriptor selfie live (dari face-api.js di app)
}

export async function checkIn(driverUserId: string, input: CheckInInput) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new AppError('Driver profile not found', 404);
  if (!driver.isApproved) throw new AppError('Driver belum di-approve', 403);

  // Verifikasi wajah: bandingkan descriptor live vs referensi tersimpan.
  const ref = parseDescriptor(driver.faceDescriptor);
  const live = parseDescriptor(input.faceDescriptor);
  const { verified, score } = verifyFace(ref, live);
  // Jika ada referensi & live tapi tidak cocok → FLAGGED. Jika belum ada referensi → PRESENT (tak bisa verifikasi).
  const status =
    ref && live && !verified ? AttendanceStatus.FLAGGED : AttendanceStatus.PRESENT;

  return prisma.attendance.create({
    data: {
      driverId: driver.id,
      latitude: input.latitude,
      longitude: input.longitude,
      selfiePhoto: input.selfiePhoto,
      matchScore: score,
      status,
    },
  });
}

// Enroll / perbarui wajah referensi (mis. dari app mobile saat pertama login)
export async function enrollFace(driverUserId: string, faceDescriptor: string) {
  const driver = await prisma.driver.findUnique({ where: { userId: driverUserId } });
  if (!driver) throw new AppError('Driver profile not found', 404);
  if (!parseDescriptor(faceDescriptor)) throw new AppError('faceDescriptor tidak valid', 400);
  await prisma.driver.update({ where: { id: driver.id }, data: { faceDescriptor } });
  return { enrolled: true };
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
