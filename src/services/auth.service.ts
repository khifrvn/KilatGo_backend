import bcrypt from 'bcryptjs';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { isTokenRevoked } from '../utils/tokenRevocation';
import { AppError } from '../middleware/error.middleware';
import { User } from '@prisma/client';
import * as settingsService from './settings.service';
import * as userService from './user.service';

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
  // Data diri
  nik?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  serviceType?: 'RIDE' | 'CAR';
  // SIM
  simType?: string;
  simNumber?: string;
  simExpiry?: string;
  // Kendaraan
  vehicleBrand?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  stnkNumber?: string;
  // Rekening & pajak
  bankName?: string;
  bankAccount?: string;
  bankHolder?: string;
  npwp?: string;
  // Dokumen (nama file yang sudah diupload)
  ktpPhoto?: string;
  selfiePhoto?: string;
  simPhoto?: string;
  stnkPhoto?: string;
  skckPhoto?: string;
  faceDescriptor?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  /** @deprecated alias of accessToken, kept for older clients. */
  token: string;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone: string;
    role: UserRole;
    status: UserStatus;
    isSuperAdmin?: boolean;
    permissions?: string[];
  };
}

/** Build the standard auth envelope (access + refresh + user) for a user row. */
async function buildAuthResponse(user: User): Promise<AuthResponse> {
  const { accessToken, refreshToken } = generateTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Untuk admin, sertakan flag superadmin + izin menu (dipakai CMS untuk RBAC menu).
  let isSuperAdmin: boolean | undefined;
  let permissions: string[] | undefined;
  if (user.role === UserRole.ADMIN) {
    const admin = await prisma.admin.findUnique({ where: { userId: user.id } });
    isSuperAdmin = !!admin?.isSuperAdmin;
    try { permissions = admin?.permissions ? JSON.parse(admin.permissions) : []; } catch { permissions = []; }
  }

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status,
      ...(user.role === UserRole.ADMIN ? { isSuperAdmin, permissions } : {}),
    },
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

  return await buildAuthResponse(user);
}

export async function registerDriver(input: RegisterDriverInput): Promise<AuthResponse> {
  const settings = await settingsService.getSettings();
  if (settings.driver_registration_open === '0') {
    throw new AppError('Pendaftaran driver sedang ditutup untuk saat ini.', 403);
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.email }, { phone: input.phone }],
    },
  });

  if (existingUser) {
    // Pendaftaran yang ditolak ditahan 3 hari (anti-spam daftar-ulang). Setelah lewat, akun lama
    // dihapus di sini juga — jadi driver tetap bisa daftar ulang walau sweeper belum sempat jalan.
    const rejected = await userService.purgeRejectedDriverUser(existingUser.id);
    if (!rejected) {
      throw new AppError('Email or phone number already registered', 409);
    }
    if (!rejected.deleted) {
      const retry = rejected.retryAt.toLocaleString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      });
      throw new AppError(
        `Pendaftaran Anda sebelumnya ditolak. Anda dapat mendaftar ulang setelah ${retry} WIB.`,
        409
      );
    }
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
          nik: input.nik,
          birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
          address: input.address,
          city: input.city,
          serviceType: input.serviceType ?? 'RIDE',
          simType: input.simType,
          simNumber: input.simNumber,
          simExpiry: input.simExpiry ? new Date(input.simExpiry) : undefined,
          vehicleBrand: input.vehicleBrand,
          vehicleYear: input.vehicleYear,
          vehicleColor: input.vehicleColor,
          stnkNumber: input.stnkNumber,
          bankName: input.bankName,
          bankAccount: input.bankAccount,
          bankHolder: input.bankHolder,
          npwp: input.npwp,
          ktpPhoto: input.ktpPhoto,
          selfiePhoto: input.selfiePhoto,
          simPhoto: input.simPhoto,
          stnkPhoto: input.stnkPhoto,
          skckPhoto: input.skckPhoto,
          faceDescriptor: input.faceDescriptor,
        },
      },
    },
  });

  return await buildAuthResponse(user);
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  // Password benar tapi akun diblokir → kirim detail suspend (alasan + kontak banding)
  // supaya app bisa menampilkan layar "Akun Diblokir" (bukan sekadar error login).
  if (user.status === UserStatus.SUSPENDED) {
    const s = await settingsService.getSettings();
    throw new AppError('Akun Anda telah diblokir', 403, {
      suspended: true,
      reason: user.suspendReason || null,
      contactWhatsapp: s.contact_whatsapp || null,
      role: user.role,
    });
  }

  return await buildAuthResponse(user);
}

/**
 * Exchange a valid refresh token for a fresh access token (and rotated refresh token).
 * Stateless: re-reads the user so role/status changes (e.g. driver approved) take effect.
 */
export async function refresh(refreshToken: string): Promise<AuthResponse> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user) {
    throw new AppError('User no longer exists', 401);
  }
  if (user.status === UserStatus.SUSPENDED) {
    throw new AppError('Account has been suspended', 403);
  }
  // Sama seperti auth.middleware: token yang terbit sebelum sandi terakhir
  // diganti tidak berlaku.
  if (isTokenRevoked(user.passwordChangedAt, payload.iat)) {
    throw new AppError('Sesi berakhir. Silakan masuk kembali.', 401);
  }

  return await buildAuthResponse(user);
}
