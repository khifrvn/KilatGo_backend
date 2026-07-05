import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { KycSubject } from '@prisma/client';
import * as adminService from '../services/admin.service';
import * as merchantService from '../services/merchant.service';
import * as attendanceService from '../services/attendance.service';
import * as kycService from '../services/kyc.service';
import * as settingsService from '../services/settings.service';
import * as complaintService from '../services/complaint.service';
import { successResponse, errorResponse } from '../utils/response';
import { UPLOAD_DIR } from '../config/upload';

// ===== Pengaturan =====
export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Settings', await settingsService.getSettings()); } catch (e) { next(e); }
}
export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Settings updated', await settingsService.updateSettings(req.body || {})); } catch (e) { next(e); }
}

// ===== Kendala / complaints =====
export async function getComplaints(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Complaints', await complaintService.listComplaints(req.query.status as string | undefined)); } catch (e) { next(e); }
}
export async function updateComplaint(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Complaint updated', await complaintService.updateComplaint(req.params.id, req.body || {})); } catch (e) { next(e); }
}

// ===== Fase 2: Merchant approval =====
export async function getPendingMerchants(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Pending merchants', await merchantService.listPendingMerchants());
  } catch (e) { next(e); }
}
export async function getMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Merchant detail', await merchantService.getMerchant(req.params.id));
  } catch (e) { next(e); }
}
export async function approveMerchant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const approve = req.body?.isApproved !== false;
    successResponse(res, approve ? 'Merchant approved' : 'Merchant rejected', await merchantService.approveMerchant(req.params.id, approve));
  } catch (e) { next(e); }
}

// ===== Fase 3: Absen & KYC =====
export async function getAttendance(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Log absen', await attendanceService.listAllAttendance({ date: req.query.date as string | undefined }));
  } catch (e) { next(e); }
}
export async function verifyKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const subjectType = String(req.params.subjectType).toUpperCase() === 'MERCHANT' ? KycSubject.MERCHANT : KycSubject.DRIVER;
    const record = await kycService.verify(subjectType, req.params.subjectId, { approve: req.body?.approve !== false, ...req.body });
    successResponse(res, 'KYC updated', record);
  } catch (e) { next(e); }
}

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
