import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service';
import { successResponse } from '../utils/response';

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
