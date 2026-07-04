import { z } from 'zod';
import { UserRole } from '@prisma/client';

export const registerCustomerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number too short'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const registerDriverSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Phone number too short'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  vehicleType: z.string().min(2, 'Vehicle type is required'),
  vehiclePlate: z.string().min(3, 'Vehicle plate is required'),
  licenseNumber: z.string().min(3, 'License number is required'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const userRoleSchema = z.nativeEnum(UserRole);
