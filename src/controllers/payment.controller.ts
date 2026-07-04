import { Request, Response, NextFunction } from 'express';
import * as paymentService from '../services/payment.service';
import { successResponse } from '../utils/response';

export async function processPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payment = await paymentService.processPayment({
      ...req.body,
      userId: req.user!.userId,
    });
    successResponse(res, 'Payment processed successfully', payment);
  } catch (error) {
    next(error);
  }
}

export async function getPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payment = await paymentService.getPayment(
      req.params.id,
      req.user!.userId,
      req.user!.role
    );
    successResponse(res, 'Payment retrieved', payment);
  } catch (error) {
    next(error);
  }
}

export async function listPayments(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payments = await paymentService.listPayments(
      req.user!.userId,
      req.user!.role
    );
    successResponse(res, 'Payments retrieved', payments);
  } catch (error) {
    next(error);
  }
}

export async function getPaymentByOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payment = await paymentService.getPaymentByOrder(req.params.orderId);
    successResponse(res, 'Payment retrieved', payment);
  } catch (error) {
    next(error);
  }
}
