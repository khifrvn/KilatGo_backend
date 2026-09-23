import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { isTokenRevoked } from '../utils/tokenRevocation';
import { errorResponse } from '../utils/response';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import * as settingsService from '../services/settings.service';

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  // token via header (default) atau query ?token= (untuk <img> dokumen KYC)
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string | undefined);

  if (!token) {
    errorResponse(res, 'Access token required', 401);
    return;
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    errorResponse(res, 'Invalid or expired token', 401);
    return;
  }

  // Cek status akun SETIAP request → blokir seketika begitu di-suspend admin
  // (tak menunggu token kedaluwarsa). Lookup PK ringan; settings hanya dibaca
  // di jalur suspend yang jarang.
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { status: true, suspendReason: true, passwordChangedAt: true },
    });
    if (!user) {
      errorResponse(res, 'Akun tidak ditemukan', 401);
      return;
    }
    // Token yang dibuat sebelum sandi terakhir diganti sudah tidak berlaku
    // (mis. token curian setelah pengguna mereset sandinya).
    if (isTokenRevoked(user.passwordChangedAt, decoded.iat)) {
      errorResponse(res, 'Sesi berakhir. Silakan masuk kembali.', 401);
      return;
    }
    if (user.status === UserStatus.SUSPENDED) {
      const s = await settingsService.getSettings();
      errorResponse(res, 'Akun Anda telah diblokir', 403, {
        suspended: true,
        reason: user.suspendReason || null,
        contactWhatsapp: s.contact_whatsapp || null,
        role: decoded.role,
      });
      return;
    }
  } catch (e) {
    // Kalau cek status gagal (mis. DB sesaat), jangan buka akses — tolak aman.
    errorResponse(res, 'Gagal memverifikasi akun', 401);
    return;
  }

  req.user = decoded;
  next();
}

export function authorizeRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Authentication required', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      errorResponse(res, 'Forbidden: insufficient permissions', 403);
      return;
    }

    next();
  };
}
