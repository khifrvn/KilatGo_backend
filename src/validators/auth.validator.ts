import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const registerCustomerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number too short'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

const optStr = z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined));

export const registerDriverSchema = z.object({
  // Akun
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number too short'),
  name: z.string().min(2, 'Name must be at least 2 characters'),

  // Data diri / KTP
  nik: z.string().regex(/^\d{16}$/, 'NIK harus 16 digit'),
  birthDate: optStr,
  address: optStr,
  city: optStr,
  serviceType: z.enum(['RIDE', 'CAR']).default('RIDE'),

  // SIM
  simType: optStr,
  simNumber: optStr,
  simExpiry: optStr,

  // Kendaraan
  vehicleType: z.string().min(2, 'Vehicle type is required'),
  vehiclePlate: z.string().min(3, 'Vehicle plate is required'),
  licenseNumber: z.string().min(3, 'License number is required'),
  vehicleBrand: optStr,
  vehicleYear: z.coerce.number().int().min(1980).max(2100).optional(),
  vehicleColor: optStr,
  stnkNumber: optStr,

  // Rekening & pajak
  bankName: optStr,
  bankAccount: optStr,
  bankHolder: optStr,
  npwp: optStr,
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userRoleSchema = z.nativeEnum(UserRole);
