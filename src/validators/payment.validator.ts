import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';

export const processPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.nativeEnum(PaymentMethod),
});
