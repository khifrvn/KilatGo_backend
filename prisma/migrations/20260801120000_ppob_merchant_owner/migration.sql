-- PPOB kini juga bisa dibeli mitra memakai saldo mitra (kolom `merchants.balance`).
-- Mitra hanya punya satu dompet, jadi kolom `wallet` tetap null untuk barisnya.
ALTER TABLE `ppob_transactions` ADD COLUMN `merchant_id` VARCHAR(191) NULL;

CREATE INDEX `ppob_transactions_merchant_id_status_idx` ON `ppob_transactions`(`merchant_id`, `status`);

ALTER TABLE `ppob_transactions`
  ADD CONSTRAINT `ppob_transactions_merchant_id_fkey`
  FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
