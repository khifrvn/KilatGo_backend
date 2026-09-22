import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { UserRole } from '@prisma/client';
import { sendToToken, isFcmConfigured } from '../utils/fcm';

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

// Broadcast notifikasi ke banyak pengguna (Customer/Driver/Merchant): simpan in-app + push FCM.
// Token: Customer di User.fcmToken, Driver di Driver.fcmToken, Merchant di Merchant.fcmToken.
const AUDIENCES = ['CUSTOMER', 'DRIVER', 'MERCHANT'] as const;
type Audience = (typeof AUDIENCES)[number];

export async function broadcast(input: { audiences: string[]; title: string; body: string }) {
  const title = (input.title || '').trim();
  const body = (input.body || '').trim();
  if (!title) throw new AppError('Judul wajib diisi', 400);
  if (!body) throw new AppError('Isi pesan wajib diisi', 400);
  const audiences = (input.audiences || []).filter((a): a is Audience => (AUDIENCES as readonly string[]).includes(a));
  if (!audiences.length) throw new AppError('Pilih minimal satu penerima', 400);

  const recipients: { userId: string; token: string | null }[] = [];
  if (audiences.includes('CUSTOMER')) {
    const rows = await prisma.user.findMany({ where: { role: UserRole.CUSTOMER }, select: { id: true, fcmToken: true } });
    rows.forEach((r) => recipients.push({ userId: r.id, token: r.fcmToken }));
  }
  if (audiences.includes('DRIVER')) {
    const rows = await prisma.driver.findMany({ select: { userId: true, fcmToken: true } });
    rows.forEach((r) => recipients.push({ userId: r.userId, token: r.fcmToken }));
  }
  if (audiences.includes('MERCHANT')) {
    const rows = await prisma.merchant.findMany({ select: { userId: true, fcmToken: true } });
    rows.forEach((r) => recipients.push({ userId: r.userId, token: r.fcmToken }));
  }

  // Simpan notifikasi in-app (satu query).
  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((r) => ({ userId: r.userId, title, body, type: 'broadcast' })),
    });
  }

  // Push ke yang punya token. ponytail: kirim per-token dalam batch 50; ganti FCM multicast bila volume besar.
  const fcmReady = isFcmConfigured();
  const tokens = recipients.map((r) => r.token).filter((t): t is string => !!t);
  let pushed = 0;
  for (let i = 0; i < tokens.length; i += 50) {
    const results = await Promise.allSettled(tokens.slice(i, i + 50).map((t) => sendToToken(t, { title, body }, { type: 'broadcast' })));
    pushed += results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  }

  const entry = { id: Date.now().toString(36), title, body, audiences, recipients: recipients.length, pushed, createdAt: new Date().toISOString() };
  await pushHistory(entry);
  // withToken: penerima yang punya token perangkat; fcmReady: apakah server terkonfigurasi FCM.
  return { recipients: recipients.length, withToken: tokens.length, pushed, fcmReady };
}

// Riwayat broadcast disimpan sebagai JSON di Setting (hindari migrasi skema). Dibatasi 50 entri terbaru.
const BROADCAST_HISTORY_KEY = 'broadcast_history';
export async function listBroadcasts() {
  const row = await prisma.setting.findUnique({ where: { key: BROADCAST_HISTORY_KEY } });
  try { return row ? JSON.parse(row.value) : []; } catch { return []; }
}
async function pushHistory(entry: unknown) {
  const list = await listBroadcasts();
  const capped = [entry, ...list].slice(0, 50);
  const value = JSON.stringify(capped);
  await prisma.setting.upsert({ where: { key: BROADCAST_HISTORY_KEY }, create: { key: BROADCAST_HISTORY_KEY, value }, update: { value } });
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
