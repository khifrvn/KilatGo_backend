import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  address: z.string().max(500).optional(), // alamat domisili (customer)
});

export const updateDriverProfileSchema = z.object({
  vehicleType: z.string().min(2).optional(),
  vehiclePlate: z.string().min(3).optional(),
  licenseNumber: z.string().min(3).optional(),
});

export const approveDriverSchema = z.object({
  isApproved: z.boolean(),
  notes: z.string().trim().max(500).optional(), // alasan tolak (opsional)
});
