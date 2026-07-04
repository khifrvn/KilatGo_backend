import bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';

export interface RegisterCustomerInput {
  email: string;
  password: string;
  phone: string;
  name: string;
}

export interface RegisterDriverInput extends RegisterCustomerInput {
  vehicleType: string;
  vehiclePlate: string;
  licenseNumber: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
  };
}

export async function registerCustomer(input: RegisterCustomerInput): Promise<AuthResponse> {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { phone: input.phone }],
    },
  });

  if (existingUser) {
    throw new AppError('Email or phone number already registered', 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      name: input.name,
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      customer: {
        create: {},
      },
    },
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}

export async function registerDriver(input: RegisterDriverInput): Promise<AuthResponse> {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { phone: input.phone }],
    },
  });

  if (existingUser) {
    throw new AppError('Email or phone number already registered', 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      name: input.name,
      role: UserRole.DRIVER,
      status: UserStatus.PENDING,
      driver: {
        create: {
          vehicleType: input.vehicleType,
          vehiclePlate: input.vehiclePlate,
          licenseNumber: input.licenseNumber,
        },
      },
    },
  });

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError('Account has been suspended', 403);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
  };
}
