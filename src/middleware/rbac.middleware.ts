import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AppError } from './error.middleware';

// Key izin per-menu (harus sama dengan CMS). "dashboard" & "admins" tidak di-grant di sini:
// dashboard boleh semua admin; admins hanya superadmin.
export const PERMISSION_KEYS = [
  'customers', 'drivers', 'merchants', 'promos', 'vouchers', 'approval', 'attendance',
  'orders', 'earnings', 'withdrawals', 'topups', 'settings', 'errors', 'notifications', 'packages', 'manual_orders', 'support',
  'ratings', 'ppob',
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

type AdminCtx = { isSuperAdmin: boolean; permissions: string[] };

// Muat konteks admin (superadmin + izin) sekali per request, di-cache di req.
async function getAdminCtx(req: Request): Promise<AdminCtx> {
  const cached = (req as any)._adminCtx as AdminCtx | undefined;
  if (cached) return cached;
  const admin = await prisma.admin.findUnique({ where: { userId: req.user!.userId } });
  let permissions: string[] = [];
  try { permissions = admin?.permissions ? JSON.parse(admin.permissions) : []; } catch { permissions = []; }
  const ctx: AdminCtx = { isSuperAdmin: !!admin?.isSuperAdmin, permissions };
  (req as any)._adminCtx = ctx;
  return ctx;
}

// Wajib punya salah satu izin (any-of). Superadmin selalu lolos.
export function requirePermission(...keys: PermissionKey[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const ctx = await getAdminCtx(req);
      if (ctx.isSuperAdmin) return next();
      if (keys.some((k) => ctx.permissions.includes(k))) return next();
      throw new AppError('Anda tidak punya akses ke menu ini', 403);
    } catch (e) { next(e); }
  };
}

// Hanya superadmin.
export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const ctx = await getAdminCtx(req);
    if (!ctx.isSuperAdmin) throw new AppError('Hanya superadmin yang boleh mengakses ini', 403);
    next();
  } catch (e) { next(e); }
}
