import { Request, Response, NextFunction } from 'express';
import * as manualOrderService from '../services/manualOrder.service';
import { successResponse } from '../utils/response';

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Order manual dibuat', await manualOrderService.createManualOrder(req.body || {})); } catch (e) { next(e); }
}
export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Order manual', await manualOrderService.listManualOrders()); } catch (e) { next(e); }
}
export async function detail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Order manual', await manualOrderService.getManualOrder(req.params.id)); } catch (e) { next(e); }
}
export async function updatePrice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Harga diperbarui', await manualOrderService.updatePrice(req.params.id, Number(req.body?.itemsTotal))); } catch (e) { next(e); }
}
export async function paymentLink(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Link bayar dibuat', await manualOrderService.generatePaymentLink(req.params.id)); } catch (e) { next(e); }
}
export async function confirmPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Pembayaran dikonfirmasi', await manualOrderService.confirmPayment(req.params.id)); } catch (e) { next(e); }
}
export async function dispatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { driverId, auto } = req.body || {};
    successResponse(res, 'Order ditawarkan ke driver', await manualOrderService.dispatchOrder(req.params.id, { driverId, auto }));
  } catch (e) { next(e); }
}
export async function onlineDrivers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Driver online', await manualOrderService.listOnlineDrivers()); } catch (e) { next(e); }
}
export async function searchCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Pelanggan', await manualOrderService.searchCustomers(String(req.query.q ?? ''))); } catch (e) { next(e); }
}
