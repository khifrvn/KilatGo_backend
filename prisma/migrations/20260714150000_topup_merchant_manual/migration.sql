-- Isi saldo manual admin: dukung top-up mitra + catatan admin.
ALTER TABLE `topups`
  ADD COLUMN `merchant_id` VARCHAR(191) NULL,
  ADD COLUMN `note` VARCHAR(191) NULL;

ALTER TABLE `topups`
  ADD CONSTRAINT `topups_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
