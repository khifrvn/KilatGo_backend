-- PPOB kini bisa dibeli driver memakai Dompet Pendapatan, bukan hanya pelanggan.
-- customer_id jadi nullable dan driver_id ditambahkan; tepat satu yang terisi.
ALTER TABLE `ppob_transactions` MODIFY `customer_id` VARCHAR(191) NULL;

ALTER TABLE `ppob_transactions` ADD COLUMN `driver_id` VARCHAR(191) NULL;

CREATE INDEX `ppob_transactions_driver_id_status_idx` ON `ppob_transactions`(`driver_id`, `status`);

ALTER TABLE `ppob_transactions`
  ADD CONSTRAINT `ppob_transactions_driver_id_fkey`
  FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Dompet driver yang dipotong; refund harus kembali ke dompet yang sama.
ALTER TABLE `ppob_transactions` ADD COLUMN `wallet` ENUM('CREDIT', 'EARNINGS') NULL;
