import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
});

export const updateDriverProfileSchema = z.object({
  vehicleType: z.string().min(2).optional(),
  vehiclePlate: z.string().min(3).optional(),
  licenseNumber: z.string().min(3).optional(),
});

export const approveDriverSchema = z.object({
  isApproved: z.boolean(),
});
