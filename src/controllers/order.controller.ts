import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import * as orderService from '../services/order.service';
import * as dispatchService from '../services/dispatch.service';
import * as merchantService from '../services/merchant.service';
import { successResponse } from '../utils/response';
import { UPLOAD_DIR } from '../config/upload';
import { ServiceType } from '@prisma/client';

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
    if (order.serviceType === ServiceType.FOOD && order.merchantId) {
      // FOOD: tahan dispatch — tunggu merchant terima. Notif ke merchant dulu.
      merchantService.notifyMerchantNewOrder(order.merchantId, order.id).catch(() => {});
    } else {
      // Mulai auto-dispatch ke driver terdekat (async, jangan blokir response).
      dispatchService.startDispatch(order.id).catch(() => {});
    }
    successResponse(res, 'Order created successfully', order, 201);
  } catch (error) {
    next(error);
  }
}

// FOOD langkah 8: driver ketik kode pickup dari merchant → status jadi ON_RIDE.
export async function verifyPickup(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.verifyPickupCode(req.params.id, req.user!.userId, req.body.code);
    successResponse(res, 'Pickup verified', order);
  } catch (error) {
    next(error);
  }
}

// FOOD/SEND: driver selesai antar + unggah bukti foto → COMPLETED.
export async function completeOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const files = req.files as { [k: string]: Express.Multer.File[] } | undefined;
    const proofPhoto = files?.photo?.[0]?.filename;
    const signaturePhoto = files?.signature?.[0]?.filename;
    if (!proofPhoto) {
      res.status(400).json({ success: false, message: 'Bukti foto wajib' });
      return;
    }
    const order = await orderService.completeWithProof(req.params.id, req.user!.userId, proofPhoto, signaturePhoto);
    successResponse(res, 'Order completed', order);
  } catch (error) {
    next(error);
  }
}

// SEND: kurir foto barang saat jemput → PICKED UP (ON_RIDE).
export async function pickupPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const photo = (req.file as Express.Multer.File | undefined)?.filename;
    if (!photo) {
      res.status(400).json({ success: false, message: 'Foto barang wajib' });
      return;
    }
    const order = await orderService.pickupWithPhoto(req.params.id, req.user!.userId, photo);
    successResponse(res, 'Barang dijemput', order);
  } catch (error) {
    next(error);
  }
}

// Rating dua arah (customer↔driver) setelah order selesai.
export async function rateOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const r = await orderService.rateOrder(req.params.id, req.user!.userId, req.user!.role, Number(req.body.stars), req.body.comment, Number(req.body.tip) || 0, req.body.target);
    successResponse(res, 'Rating tersimpan', r);
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
    dispatchService.onOrderTaken(req.params.id); // stop nawarin ke driver lain
    successResponse(res, 'Order accepted', order);
  } catch (error) {
    next(error);
  }
}

// Polling driver: order yang sedang ditawarkan ke dia (atau null).
export async function getMyOffer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const offer = await dispatchService.getOfferForDriver(req.user!.userId);
    successResponse(res, 'Offer', offer);
  } catch (error) {
    next(error);
  }
}

export async function declineOffer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await dispatchService.declineOffer(req.params.id, req.user!.userId);
    successResponse(res, 'Offer declined', { ok: true });
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

// Daftar percakapan customer↔driver (aturan 1 hari diterapkan di service).
export async function listConversations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    successResponse(res, 'Conversations', await orderService.listConversations(req.user!.userId, req.user!.role));
  } catch (error) {
    next(error);
  }
}

// Foto profil driver (selfie) untuk pihak order. File privat → stream via endpoint ber-token.
export async function getDriverPhoto(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = await orderService.getOrderDriverPhotoName(req.params.id, req.user!.userId, req.user!.role);
    const filePath = path.join(UPLOAD_DIR, path.basename(name)); // basename cegah path traversal
    if (!filePath.startsWith(UPLOAD_DIR) || !fs.existsSync(filePath)) {
      res.status(404).json({ success: false, message: 'File not found' });
      return;
    }
    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}

export async function listMessages(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messages = await orderService.listMessages(req.params.id, req.user!.userId, req.user!.role);
    successResponse(res, 'Messages retrieved', messages);
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = (req.body?.body ?? '').toString();
    const message = await orderService.sendMessage(req.params.id, req.user!.userId, req.user!.role, body);
    successResponse(res, 'Message sent', message);
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
    const orders = await orderService.findAvailableOrders(req.user!.userId);
    successResponse(res, 'Available orders retrieved', orders);
  } catch (error) {
    next(error);
  }
}

export async function getActiveOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.getActiveOrder(req.user!.userId);
    successResponse(res, 'Active order', order);
  } catch (error) {
    next(error);
  }
}

// Boost pencarian driver (pelanggan / mitra pemilik order).
export async function boostOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Boost diaktifkan', await dispatchService.boostOrder(req.params.id, req.user!.userId)); } catch (e) { next(e); }
}
export async function getBoostInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, 'Info boost', await dispatchService.getBoostInfo(req.params.id, req.user!.userId)); } catch (e) { next(e); }
}

export async function getCustomerActiveOrder(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.getCustomerActiveOrder(req.user!.userId);
    successResponse(res, 'Active order', order);
  } catch (error) {
    next(error);
  }
}
