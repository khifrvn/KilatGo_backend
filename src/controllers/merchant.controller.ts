import { Request, Response, NextFunction } from 'express';
import * as merchantService from '../services/merchant.service';
import * as merchantPromoService from '../services/merchantPromo.service';
import * as topupService from '../services/topup.service';
import { AppError } from '../middleware/error.middleware';
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

export async function updateMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const photo = (req.file as Express.Multer.File | undefined)?.filename;
    const menu = await merchantService.updateMenu(req.user!.userId, req.params.id, { ...req.body, ...(photo ? { photo } : {}) });
    successResponse(res, 'Menu updated', menu);
  } catch (error) {
    next(error);
  }
}

export async function deleteMenu(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await merchantService.deleteMenu(req.user!.userId, req.params.id);
    successResponse(res, 'Menu deleted', result);
  } catch (error) {
    next(error);
  }
}

export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cats = await merchantService.listCategories(req.user!.userId);
    successResponse(res, 'Categories', cats);
  } catch (error) {
    next(error);
  }
}

export async function addCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await merchantService.addCategory(req.user!.userId, req.body.name);
    successResponse(res, 'Category added', cat, 201);
  } catch (error) {
    next(error);
  }
}

export async function renameCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cat = await merchantService.renameCategory(req.user!.userId, req.params.id, req.body.name);
    successResponse(res, 'Category renamed', cat);
  } catch (error) {
    next(error);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await merchantService.deleteCategory(req.user!.userId, req.params.id);
    successResponse(res, 'Category deleted', result);
  } catch (error) {
    next(error);
  }
}

// ===== Orders =====
export async function listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as any;
    const orders = await merchantService.listMerchantOrders(req.user!.userId, status || undefined);
    successResponse(res, 'Merchant orders', orders);
  } catch (error) {
    next(error);
  }
}

export async function getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await merchantService.getMerchantOrder(req.user!.userId, req.params.id);
    successResponse(res, 'Merchant order', order);
  } catch (error) {
    next(error);
  }
}

// PATCH /merchants/orders/:id/status  body { action: 'accept' | 'reject', reason? }
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, reason } = req.body || {};
    const order =
      action === 'accept'
        ? await merchantService.acceptOrder(req.user!.userId, req.params.id)
        : await merchantService.rejectOrder(req.user!.userId, req.params.id, reason);
    successResponse(res, 'Order updated', order);
  } catch (error) {
    next(error);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.updateMe(req.user!.userId, req.body);
    successResponse(res, 'Profil diperbarui', merchant);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const logo = (req.file as Express.Multer.File | undefined)?.filename;
    const merchant = await merchantService.updateProfile(req.user!.userId, req.body, logo);
    successResponse(res, 'Profil restoran diperbarui', merchant);
  } catch (error) {
    next(error);
  }
}

export async function getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, 'Report', await merchantService.getMyReport(req.user!.userId));
  } catch (error) {
    next(error);
  }
}

export async function getWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const wallet = await merchantService.getWallet(req.user!.userId);
    successResponse(res, 'Wallet', wallet);
  } catch (error) {
    next(error);
  }
}

export async function createWithdrawal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const w = await merchantService.createWithdrawal(req.user!.userId, Number(req.body.amount), String(req.body?.pin ?? ''));
    successResponse(res, 'Penarikan diajukan', w, 201);
  } catch (error) {
    next(error);
  }
}
export async function getWithdrawPinStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Status PIN', await merchantService.getWithdrawPinStatus(req.user!.userId)); } catch (e) { next(e); }
}
export async function setWithdrawPin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'PIN disimpan', await merchantService.setWithdrawPin(req.user!.userId, String(req.body?.pin ?? ''), req.body?.oldPin)); } catch (e) { next(e); }
}
export async function resetWithdrawPin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'PIN direset', await merchantService.resetWithdrawPin(req.user!.userId, String(req.body?.password ?? ''), String(req.body?.newPin ?? ''))); } catch (e) { next(e); }
}

// ===== Promosi berbayar mitra ("Promosikan Jualan kamu") =====
export async function getPromo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Info promosi', await merchantPromoService.getPromoInfo(req.user!.userId)); } catch (e) { next(e); }
}
export async function buyPromo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idx = Number(req.body?.packageIndex);
    if (!Number.isInteger(idx) || idx < 0) throw new AppError('packageIndex tidak valid', 400);
    successResponse(res, 'Promosi aktif', await merchantPromoService.buyPromo(req.user!.userId, idx), 201);
  } catch (e) { next(e); }
}
// Isi saldo mitra via iPaymu (dipakai saat saldo kurang untuk beli promosi).
export async function createTopUp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Top up dibuat', await topupService.createMerchantTopUp(req.user!.userId, Number(req.body?.amount))); } catch (e) { next(e); }
}
export async function getTopUpStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Status', await topupService.getMerchantTopUpStatus(req.user!.userId, req.params.referenceId)); } catch (e) { next(e); }
}

export async function setFcmToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.body?.fcmToken;
    if (!token) {
      res.status(400).json({ success: false, message: 'fcmToken wajib' });
      return;
    }
    const result = await merchantService.setFcmToken(req.user!.userId, token);
    successResponse(res, 'FCM token updated', result);
  } catch (error) {
    next(error);
  }
}

// ===== Browse publik =====
export async function listPublic(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchants = await merchantService.listPublicMerchants();
    successResponse(res, 'Merchants', merchants);
  } catch (error) {
    next(error);
  }
}

export async function getPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const merchant = await merchantService.getPublicMerchant(req.params.id);
    successResponse(res, 'Merchant', merchant);
  } catch (error) {
    next(error);
  }
}
