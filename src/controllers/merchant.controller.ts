import { Request, Response, NextFunction } from 'express';
import * as merchantService from '../services/merchant.service';
import { successResponse } from '../utils/response';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const files = (req.files as Record<string, Express.Multer.File[]>) || {};
    const f = (n: string) => files[n]?.[0]?.filename;
    const result = await merchantService.registerMerchant({
      ...req.body,
      ktpPhoto: f('ktpPhoto'),
      outletPhoto: f('outletPhoto'),
      npwpPhoto: f('npwpPhoto'),
    });
    successResponse(res, 'Merchant registered successfully. Awaiting admin approval.', result, 201);
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.getMerchantByUser(req.user!.userId);
    successResponse(res, 'Merchant profile', merchant);
  } catch (error) {
    next(error);
  }
}

export async function addMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const photo = (req.file as Express.Multer.File | undefined)?.filename;
    const menu = await merchantService.addMenu(req.user!.userId, { ...req.body, photo });
    successResponse(res, 'Menu added', menu, 201);
  } catch (error) {
    next(error);
  }
}
