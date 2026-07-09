// Curated voucher catalog. ponytail: a constant list (no DB table) is enough
// until vouchers become admin-managed — then promote this to a Prisma model.

export type VoucherType = 'PERCENT' | 'FIXED';

export interface Voucher {
  code: string;
  title: string;
  description: string;
  type: VoucherType;
  value: number; // percent (0-100) or rupiah
  minFare: number; // eligibility threshold
  maxDiscount?: number; // cap for PERCENT
  serviceType?: 'RIDE' | 'CAR'; // undefined = any service
}

export const VOUCHERS: Voucher[] = [
  { code: 'KILAT20', title: 'Diskon 20%', description: 'Potongan 20%, maks Rp10.000', type: 'PERCENT', value: 20, minFare: 15000, maxDiscount: 10000 },
  { code: 'HEMAT10', title: 'Potongan Rp10.000', description: 'Min. transaksi Rp20.000', type: 'FIXED', value: 10000, minFare: 20000 },
  { code: 'NAIKMOTOR', title: 'Ride Rp5.000', description: 'Khusus Kilat Ride, min Rp8.000', type: 'FIXED', value: 5000, minFare: 8000, serviceType: 'RIDE' },
  { code: 'MOBILHEMAT', title: 'Car Rp15.000', description: 'Khusus Kilat Car, min Rp30.000', type: 'FIXED', value: 15000, minFare: 30000, serviceType: 'CAR' },
];

/** Discount this voucher yields on `fare` (never exceeds the fare). */
export function computeDiscount(v: Voucher, fare: number): number {
  let d = v.type === 'PERCENT' ? Math.round((fare * v.value) / 100) : v.value;
  if (v.maxDiscount != null) d = Math.min(d, v.maxDiscount);
  return Math.min(d, fare);
}

export function findVoucher(code: string): Voucher | undefined {
  return VOUCHERS.find((v) => v.code.toUpperCase() === code.toUpperCase());
}

function isEligible(v: Voucher, fare: number, serviceType: 'RIDE' | 'CAR'): boolean {
  if (fare < v.minFare) return false;
  if (v.serviceType && v.serviceType !== serviceType) return false;
  return true;
}

/** Vouchers usable for this fare + service, each with its computed discount. */
export function listApplicableVouchers(fare: number, serviceType: 'RIDE' | 'CAR') {
  return VOUCHERS.filter((v) => isEligible(v, fare, serviceType)).map((v) => ({
    ...v,
    discount: computeDiscount(v, fare),
  }));
}
