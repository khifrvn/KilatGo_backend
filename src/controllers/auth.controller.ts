import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { successResponse } from '../utils/response';

export async function registerCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.registerCustomer(req.body);
    successResponse(res, 'Customer registered successfully', result, 201);
  } catch (error) {
    next(error);
  }
}

export async function registerDriver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.registerDriver(req.body);
    successResponse(res, 'Driver registered successfully. Awaiting admin approval.', result, 201);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    successResponse(res, 'Login successful', result);
  } catch (error) {
    next(error);
  }
}
