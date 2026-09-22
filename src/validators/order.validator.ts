import { z } from 'zod';
import { OrderStatus, PaymentMethod, ServiceType } from '@prisma/client';

// FOOD: pickup diturunkan dari lokasi warung di server, jadi pickup* opsional.
// Untuk RIDE/CAR/SEND service memvalidasi pickup wajib.
export const createOrderSchema = z.object({
  pickupLat: z.number().min(-90).max(90).optional(),
  pickupLng: z.number().min(-180).max(180).optional(),
  pickupAddress: z.string().min(5).optional(),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  dropoffAddress: z.string().min(5),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  serviceType: z.nativeEnum(ServiceType).default(ServiceType.RIDE),
  voucherCode: z.string().optional(),
  notes: z.string().optional(),
  distanceKm: z.coerce.number().min(0).optional(),
  // FOOD only:
  merchantId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        menuId: z.string().uuid().optional(),
        name: z.string().min(1),
        price: z.coerce.number().nonnegative(),
        quantity: z.coerce.number().int().positive(),
        note: z.string().optional(),
      })
    )
    .optional(),
  // SEND only:
  packageType: z.enum(['DOCUMENT', 'SMALL', 'MEDIUM', 'LARGE']).optional(),
  packageContents: z.string().max(200).optional(),
  recipientName: z.string().max(100).optional(),
  recipientPhone: z.string().max(30).optional(),
});

export const verifyPickupSchema = z.object({
  code: z.string().min(1),
});

export const rateOrderSchema = z.object({
  stars: z.coerce.number().min(1).max(5),
  comment: z.string().optional(),
  tip: z.coerce.number().min(0).optional(),
  target: z.enum(['DRIVER', 'MERCHANT']).optional(), // FOOD: customer nilai driver / resto
});

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(3).optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string().uuid(),
});
