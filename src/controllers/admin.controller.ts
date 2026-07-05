import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import * as adminService from '../services/admin.service';
import { successResponse, errorResponse } from '../utils/response';
import { UPLOAD_DIR } from '../config/upload';

// Serve dokumen KYC privat (admin-only via admin.routes). Token boleh via ?token= untuk <img>.
export function getDriverDocument(req: Request, res: Response): void {
  const name = path.basename(req.params.name); // cegah path traversal
  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
    errorResponse(res, 'File not found', 404);
    return;
  }
  res.sendFile(filePath);
}

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    successResponse(res, 'Dashboard stats retrieved', stats);
  } catch (error) {
    next(error);
  }
}

export async function getAllOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await adminService.getAllOrders({
      status: req.query.status as any,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    successResponse(res, 'Orders retrieved', orders.data, 200, orders.meta);
  } catch (error) {
    next(error);
  }
}

export async function getEarningsReport(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const report = await adminService.getEarningsReport({
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      groupBy: req.query.groupBy as any,
    });
    successResponse(res, 'Earnings report retrieved', report);
  } catch (error) {
    next(error);
  }
}

export async function getPendingDrivers(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const drivers = await adminService.getPendingDrivers();
    successResponse(res, 'Pending drivers retrieved', drivers);
  } catch (error) {
    next(error);
  }
}

export async function suspendUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await adminService.suspendUser(req.params.id);
    successResponse(res, 'User suspended', user);
  } catch (error) {
    next(error);
  }
}

export async function activateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await adminService.activateUser(req.params.id);
    successResponse(res, 'User activated', user);
  } catch (error) {
    next(error);
  }
}
