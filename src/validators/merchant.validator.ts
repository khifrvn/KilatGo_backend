import { z } from 'zod';

const optStr = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));

export const registerMerchantSchema = z.object({
  // Akun
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number too short'),
  ownerName: z.string().min(2, 'Nama pemilik wajib'),

  // Usaha
  businessName: z.string().min(2, 'Nama usaha wajib'),
  category: optStr,
  nik: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit'),
  address: optStr,
  city: optStr,
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  operatingHours: optStr,

  // Legalitas & rekening
  npwp: optStr,
  nib: optStr,
  siup: optStr,
  bankName: optStr,
  bankAccount: optStr,
  bankHolder: optStr,
});

export const addMenuSchema = z.object({
  name: z.string().min(1, 'Nama menu wajib'),
  price: z.coerce.number().nonnegative('Harga tidak valid'),
  description: optStr,
  category: optStr,
});
