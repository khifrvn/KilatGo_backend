import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import * as promoService from '../services/promo.service';
import { successResponse } from '../utils/response';

// form-data → boolean string
const toBool = (v: unknown) => (v === undefined ? undefined : v === true || v === 'true');

// ===== App: promo untuk role pemanggil =====
export async function listMine(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const role = req.user!.role;
    const audience = role === UserRole.DRIVER ? 'DRIVER' : role === UserRole.MERCHANT ? 'MERCHANT' : 'CUSTOMER';
    const placement = typeof req.query.placement === 'string' ? req.query.placement : undefined;
    successResponse(res, 'Promos', await promoService.listForAudience(audience, placement));
  } catch (e) { next(e); }
}

// ===== Admin CRUD =====
export async function list(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Promos', await promoService.listAll()); } catch (e) { next(e); }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const image = (req.file as Express.Multer.File | undefined)?.filename;
    const promo = await promoService.create({ ...req.body, isActive: toBool(req.body.isActive), image });
    successResponse(res, 'Promo dibuat', promo, 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const image = (req.file as Express.Multer.File | undefined)?.filename;
    const promo = await promoService.update(req.params.id, { ...req.body, isActive: toBool(req.body.isActive), ...(image ? { image } : {}) });
    successResponse(res, 'Promo diperbarui', promo);
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Promo dihapus', await promoService.remove(req.params.id)); } catch (e) { next(e); }
}
