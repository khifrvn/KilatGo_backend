import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';
import { successResponse } from '../utils/response';

export async function listNotifications(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const onlyUnread = req.query.unread === 'true';
    const notifications = await notificationService.listNotifications(
      req.user!.userId,
      onlyUnread
    );
    successResponse(res, 'Notifications retrieved', notifications);
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const notification = await notificationService.markAsRead(
      req.params.id,
      req.user!.userId
    );
    successResponse(res, 'Notification marked as read', notification);
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await notificationService.markAllAsRead(req.user!.userId);
    successResponse(res, 'All notifications marked as read', result);
  } catch (error) {
    next(error);
  }
}
