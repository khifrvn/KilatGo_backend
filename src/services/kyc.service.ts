import { KycSubject, KycStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface VerifyInput {
  approve: boolean;
  faceMatchScore?: number;
  livenessPassed?: boolean;
  ocrName?: string;
  ocrNik?: string;
  notes?: string;
  provider?: string; // null/undefined = manual admin
}

// Manual verify oleh admin. Untuk KYC otomatis: panggil vendor (OCR+face+liveness),
// isi faceMatchScore/livenessPassed/ocr*, lalu approve otomatis bila lolos ambang.
export async function verify(subjectType: KycSubject, subjectId: string, input: VerifyInput) {
  // pastikan subjek ada
  if (subjectType === KycSubject.DRIVER) {
    const d = await prisma.driver.findUnique({ where: { id: subjectId } });
    if (!d) throw new AppError('Driver not found', 404);
  } else {
    const m = await prisma.merchant.findUnique({ where: { id: subjectId } });
    if (!m) throw new AppError('Merchant not found', 404);
  }

  const status = input.approve ? KycStatus.VERIFIED : KycStatus.REJECTED;

  const record = await prisma.kycVerification.create({
    data: {
      subjectType,
      subjectId,
      status,
      faceMatchScore: input.faceMatchScore ?? null,
      livenessPassed: input.livenessPassed ?? null,
      ocrName: input.ocrName,
      ocrNik: input.ocrNik,
      notes: input.notes,
      provider: input.provider ?? 'manual',
      verifiedAt: new Date(),
    },
  });

  if (subjectType === KycSubject.DRIVER) {
    await prisma.driver.update({ where: { id: subjectId }, data: { kycStatus: status } });
  } else {
    await prisma.merchant.update({ where: { id: subjectId }, data: { kycStatus: status } });
  }

  return record;
}

export async function history(subjectType: KycSubject, subjectId: string) {
  return prisma.kycVerification.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: 'desc' },
  });
}
