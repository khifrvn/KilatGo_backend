/**
 * Cek masa tahan 3 hari untuk pendaftaran driver yang ditolak.
 * Jalankan: npx tsx src/scripts/check-reject-purge.ts   (butuh DB lokal)
 * Data uji dibuat & dihapus sendiri.
 */
import assert from 'node:assert';
import { KycStatus, KycSubject, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { purgeRejectedDriverUser, REJECT_HOLD_MS } from '../services/user.service';

async function makeRejectedDriver(tag: string, rejectedAgoMs: number) {
  const user = await prisma.user.create({
    data: {
      email: `purge-check-${tag}@example.test`,
      password: 'x',
      phone: `0800000${tag}`,
      name: `Purge Check ${tag}`,
      role: UserRole.DRIVER,
      status: UserStatus.PENDING,
      driver: {
        create: {
          vehicleType: 'Beat',
          vehiclePlate: `TEST ${tag}`,
          licenseNumber: `SIM${tag}`,
          isApproved: false,
          kycStatus: KycStatus.REJECTED,
        },
      },
    },
    include: { driver: true },
  });
  await prisma.kycVerification.create({
    data: {
      subjectType: KycSubject.DRIVER,
      subjectId: user.driver!.id,
      status: KycStatus.REJECTED,
      notes: 'cek otomatis',
      createdAt: new Date(Date.now() - rejectedAgoMs),
    },
  });
  return user;
}

async function main() {
  // 1) Baru ditolak (1 jam lalu) → masih ditahan, akun tetap ada.
  const fresh = await makeRejectedDriver('fresh', 60 * 60 * 1000);
  const held = await purgeRejectedDriverUser(fresh.id);
  assert.ok(held && !held.deleted, 'driver baru ditolak seharusnya masih ditahan');
  assert.ok(held.retryAt > new Date(), 'retryAt harus di masa depan');
  assert.ok(await prisma.user.findUnique({ where: { id: fresh.id } }), 'akun belum boleh dihapus');

  // 2) Ditolak > 3 hari → akun dihapus, email/HP bebas untuk daftar ulang.
  const old = await makeRejectedDriver('old', REJECT_HOLD_MS + 60 * 60 * 1000);
  const purged = await purgeRejectedDriverUser(old.id);
  assert.ok(purged?.deleted, 'driver ditolak > 3 hari seharusnya dihapus');
  assert.equal(await prisma.user.findUnique({ where: { id: old.id } }), null, 'akun harus hilang');

  // 3) Driver yang disetujui tidak pernah tersentuh purge.
  const okDriver = await makeRejectedDriver('appr', REJECT_HOLD_MS * 2);
  await prisma.driver.update({
    where: { userId: okDriver.id },
    data: { isApproved: true, kycStatus: KycStatus.VERIFIED },
  });
  assert.equal(await purgeRejectedDriverUser(okDriver.id), null, 'driver disetujui harus diabaikan');
  assert.ok(await prisma.user.findUnique({ where: { id: okDriver.id } }), 'driver disetujui tetap ada');

  // bersih-bersih
  await prisma.user.deleteMany({ where: { email: { startsWith: 'purge-check-' } } });
  console.log('OK — masa tahan 3 hari & purge pendaftaran ditolak jalan');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
