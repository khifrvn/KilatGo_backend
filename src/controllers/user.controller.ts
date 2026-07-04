import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { successResponse } from '../utils/response';

export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.getProfile(req.user!.userId);
    successResponse(res, 'Profile retrieved', profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.updateProfile(req.user!.userId, req.body);
    successResponse(res, 'Profile updated', profile);
  } catch (error) {
    next(error);
  }
}

export async function updateDriverProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await userService.updateDriverProfile(req.user!.userId, req.body);
    successResponse(res, 'Driver profile updated', profile);
  } catch (error) {
    next(error);
  }
}

export async function listDrivers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const drivers = await userService.listDrivers(req.query);
    successResponse(res, 'Drivers retrieved', drivers);
  } catch (error) {
    next(error);
  }
}

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customers = await userService.listCustomers();
    successResponse(res, 'Customers retrieved', customers);
  } catch (error) {
    next(error);
  }
}

export async function approveDriver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const driver = await userService.approveDriver(req.params.id, req.body.isApproved);
    successResponse(res, 'Driver approval updated', driver);
  } catch (error) {
    next(error);
  }
}

export async function listAllUsers(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const users = await userService.listAllUsers(req.query.role as any);
    successResponse(res, 'Users retrieved', users);
  } catch (error) {
    next(error);
  }
}
