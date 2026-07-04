import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/order.service';
import { successResponse } from '../utils/response';
import { UserRole } from '@prisma/client';

export async function createOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.createOrder({
      ...req.body,
      customerId: req.user!.userId,
    });
    successResponse(res, 'Order created successfully', order, 201);
  } catch (error) {
    next(error);
  }
}

export async function assignDriver(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.assignDriver(req.params.id, req.user!.userId);
    successResponse(res, 'Order accepted', order);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.updateOrderStatus(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.status
    );
    successResponse(res, 'Order status updated', order);
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.cancelOrder(
      req.params.id,
      req.user!.userId,
      req.user!.role,
      req.body.reason
    );
    successResponse(res, 'Order cancelled', order);
  } catch (error) {
    next(error);
  }
}

export async function getOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.getOrder(req.params.id, req.user!.userId, req.user!.role);
    successResponse(res, 'Order retrieved', order);
  } catch (error) {
    next(error);
  }
}

export async function listOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await orderService.listOrders(
      req.user!.userId,
      req.user!.role,
      req.query.status as any
    );
    successResponse(res, 'Orders retrieved', orders);
  } catch (error) {
    next(error);
  }
}

export async function findAvailableOrders(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const orders = await orderService.findAvailableOrders();
    successResponse(res, 'Available orders retrieved', orders);
  } catch (error) {
    next(error);
  }
}
