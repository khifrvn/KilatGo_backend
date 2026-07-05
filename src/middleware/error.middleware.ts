import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { logError } from '../services/errorlog.service';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

function record(err: Error, req: Request, statusCode: number) {
  logError({
    statusCode,
    message: err.message || err.name,
    path: (req as any).originalUrl || req.url,
    method: req.method,
    stack: err.stack,
    userId: (req as any).user?.userId,
  });
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) record(err, req, err.statusCode);
    return errorResponse(res, err.message, err.statusCode);
  }

  if (err instanceof ZodError) {
    return errorResponse(res, 'Validation failed', 400, err.errors);
  }

  if (err instanceof MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File terlalu besar (maks 5MB)' : `Upload error: ${err.message}`;
    return errorResponse(res, msg, 400);
  }

  if (err.message?.startsWith('Only ')) {
    return errorResponse(res, err.message, 400);
  }

  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', 401);
  }

  console.error('Unhandled error:', err);
  record(err, req, 500);
  return errorResponse(res, 'Internal server error', 500);
}
