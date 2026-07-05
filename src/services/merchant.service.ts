import bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { generateToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';

export interface RegisterMerchantInput {
  email: string;
  password: string;
  phone: string;
  ownerName: string;
  businessName: string;
  category?: string;
  nik?: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  operatingHours?: string;
  npwp?: string;
  nib?: string;
  siup?: string;
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  // dokumen
  ktpPhoto?: string;
  outletPhoto?: string;
  npwpPhoto?: string;
}

export async function registerMerchant(input: RegisterMerchantInput) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { phone: input.phone }] },
  });
  if (existing) throw new AppError('Email or phone number already registered', 409);

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      phone: input.phone,
      name: input.ownerName,
      role: UserRole.MERCHANT,
      status: UserStatus.PENDING,
      merchant: {
        create: {
          businessName: input.businessName,
          category: input.category,
          ownerName: input.ownerName,
          nik: input.nik,
          phone: input.phone,
          address: input.address,
          city: input.city,
          latitude: input.latitude,
          longitude: input.longitude,
          operatingHours: input.operatingHours,
          npwp: input.npwp,
          nib: input.nib,
          siup: input.siup,
          bankName: input.bankName,
          bankAccount: input.bankAccount,
          bankHolder: input.bankHolder,
          ktpPhoto: input.ktpPhoto,
          outletPhoto: input.outletPhoto,
          npwpPhoto: input.npwpPhoto,
        },
      },
    },
  });

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role, status: user.status },
  };
}

export async function listPendingMerchants() {
  return prisma.merchant.findMany({
    where: { isApproved: false },
    include: { user: { select: { id: true, email: true, name: true, phone: true, status: true, createdAt: true } }, menus: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getMerchant(id: string) {
  const m = await prisma.merchant.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, phone: true, status: true } }, menus: true },
  });
  if (!m) throw new AppError('Merchant not found', 404);
  return m;
}

export async function approveMerchant(id: string, approve: boolean) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) throw new AppError('Merchant not found', 404);

  if (approve) {
    return prisma.merchant.update({
      where: { id },
      data: { isApproved: true, user: { update: { status: UserStatus.ACTIVE } } },
    });
  }
  // reject → hapus akun merchant
  await prisma.user.delete({ where: { id: merchant.userId } });
  return { id, rejected: true };
}

// ===== Menu =====
export async function getMerchantByUser(userId: string) {
  const m = await prisma.merchant.findUnique({ where: { userId }, include: { menus: true } });
  if (!m) throw new AppError('Merchant profile not found', 404);
  return m;
}

export async function addMenu(userId: string, input: { name: string; price: number; description?: string; category?: string; photo?: string }) {
  const merchant = await prisma.merchant.findUnique({ where: { userId } });
  if (!merchant) throw new AppError('Merchant profile not found', 404);
  return prisma.merchantMenu.create({
    data: {
      merchantId: merchant.id,
      name: input.name,
      price: input.price,
      description: input.description,
      category: input.category,
      photo: input.photo,
    },
  });
}
