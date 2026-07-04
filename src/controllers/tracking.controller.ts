import { Request, Response, NextFunction } from 'express';
import * as trackingService from '../services/tracking.service';
import { successResponse } from '../utils/response';

export async function updateLocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { latitude, longitude } = req.body;
    const driver = await trackingService.updateDriverLocation(
      req.user!.userId,
      latitude,
      longitude
    );
    successResponse(res, 'Location updated', driver);
  } catch (error) {
    next(error);
  }
}

export async function getMyLocation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await trackingService.getDriverLocation(req.user!.userId);
    successResponse(res, 'Driver location retrieved', driver);
  } catch (error) {
    next(error);
  }
}

export async function setOnline(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await trackingService.setDriverOnline(req.user!.userId);
    successResponse(res, 'Driver is now online', driver);
  } catch (error) {
    next(error);
  }
}

export async function setOffline(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await trackingService.setDriverOffline(req.user!.userId);
    successResponse(res, 'Driver is now offline', driver);
  } catch (error) {
    next(error);
  }
}

export async function getOrderTracking(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await trackingService.getOrderTracking(req.params.orderId);
    successResponse(res, 'Order tracking retrieved', order);
  } catch (error) {
    next(error);
  }
}
