import { ComplaintFrom, ComplaintStatus, UserRole } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateComplaintInput {
  subject: string;
  message: string;
  category?: string;
}

export async function createComplaint(userId: string, role: UserRole, input: CreateComplaintInput) {
  if (role !== UserRole.DRIVER && role !== UserRole.MERCHANT) {
    throw new AppError('Hanya driver/mitra yang bisa mengirim kendala', 403);
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return prisma.complaint.create({
    data: {
      fromRole: role === UserRole.DRIVER ? ComplaintFrom.DRIVER : ComplaintFrom.MERCHANT,
      fromUserId: userId,
      fromName: user?.name,
      subject: input.subject,
      message: input.message,
      category: input.category,
    },
  });
}

export async function listComplaints(status?: string) {
  const where = status && ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(status)
    ? { status: status as ComplaintStatus }
    : {};
  return prisma.complaint.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
}

export async function updateComplaint(id: string, data: { status?: string; adminNote?: string }) {
  const c = await prisma.complaint.findUnique({ where: { id } });
  if (!c) throw new AppError('Kendala tidak ditemukan', 404);
  const status = data.status && ['OPEN', 'IN_PROGRESS', 'RESOLVED'].includes(data.status)
    ? (data.status as ComplaintStatus)
    : undefined;
  return prisma.complaint.update({
    where: { id },
    data: {
      status,
      adminNote: data.adminNote,
      resolvedAt: status === ComplaintStatus.RESOLVED ? new Date() : undefined,
    },
  });
}
