import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
}

export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
    },
  });

  // Mock push notification: in production, integrate FCM/OneSignal here
  console.log(`[PUSH] To ${input.userId}: ${input.title} - ${input.body}`);

  return notification;
}

export async function listNotifications(userId: string, onlyUnread: boolean = false) {
  const where: any = { userId };

  if (onlyUnread) {
    where.isRead = false;
  }

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return notifications;
}

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (notification.userId !== userId) {
    throw new AppError('Not authorized', 403);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return updated;
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return result;
}
