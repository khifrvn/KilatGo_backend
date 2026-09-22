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

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nama kategori wajib').max(50),
});

export const addMenuSchema = z.object({
  name: z.string().min(1, 'Nama menu wajib'),
  price: z.coerce.number().nonnegative('Harga tidak valid'),
  description: optStr,
  category: optStr,
});

// form-data → boolean dikirim sebagai string 'true'/'false'
const optBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === true || v === 'true'));

export const updateMenuSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.coerce.number().nonnegative().optional(),
  description: optStr,
  category: optStr,
  isAvailable: optBool,
  // '' → null (stok tak terbatas); angka → int >= 0; absen → tak diubah
  stock: z.preprocess((v) => (v === '' ? null : v), z.coerce.number().int().nonnegative().nullable().optional()),
});

export const merchantOrderActionSchema = z.object({
  action: z.enum(['accept', 'reject']),
  reason: z.string().optional(),
});

const dayHours = z.object({
  open: z.string().optional(),
  close: z.string().optional(),
  closed: z.boolean().optional(),
});
export const updateMerchantMeSchema = z.object({
  isOpen: optBool,
  operatingHours: optStr,
  // { mon:{open,close,closed}, ... } — hari bebas, cukup subset.
  operatingSchedule: z.record(z.string(), dayHours).optional(),
});

// Profil restoran (multipart, logo opsional).
export const updateProfileSchema = z.object({
  businessName: z.string().min(1).optional(),
  category: optStr,
  description: optStr,
  phone: optStr,
  address: optStr,
  city: optStr,
  bankName: optStr,
  bankAccount: optStr,
  bankHolder: optStr,
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().positive(),
  pin: z.string().optional(),
});
