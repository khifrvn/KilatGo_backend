import { Request, Response, NextFunction } from 'express';
import * as packageService from '../services/driverPackage.service';
import { successResponse } from '../utils/response';

// ===== Driver =====
export async function info(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Info paket', await packageService.getPackageInfo()); } catch (e) { next(e); }
}
export async function buy(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Pesanan paket dibuat', await packageService.createOrder(req.user!.userId)); } catch (e) { next(e); }
}
export async function myOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Pesanan paket', await packageService.listMyOrders(req.user!.userId)); } catch (e) { next(e); }
}
export async function repay(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Link pembayaran baru', await packageService.repayOrder(req.user!.userId, req.params.id)); } catch (e) { next(e); }
}

// ===== Admin =====
export async function adminList(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Pesanan paket', await packageService.listOrders()); } catch (e) { next(e); }
}
export async function adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, adminNote } = req.body || {};
    successResponse(res, 'Pesanan diperbarui', await packageService.updateOrder(req.params.id, { status, adminNote }));
  } catch (e) { next(e); }
}
export async function adminGetPrice(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Harga paket', await packageService.getAdminInfo()); } catch (e) { next(e); }
}
export async function adminSetPrice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Harga disimpan', await packageService.setPrice(Number(req.body?.price))); } catch (e) { next(e); }
}
