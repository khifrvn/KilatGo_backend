import { Prisma, PrismaClient } from '@prisma/client';

// Prisma Decimal → JSON number (bukan string). Tanpa ini endpoint order mengirim
// totalFare/itemsTotal/harga sebagai string → app driver/customer crash saat cast
// `as num`. Wallet sudah Number()-kan manual; ini menyeragamkan sisanya sekali.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON = function (
  this: Prisma.Decimal,
) {
  return this.toNumber();
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
