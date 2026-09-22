-- AlterTable
ALTER TABLE `merchants` ADD COLUMN `balance` DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `merchant_withdrawals` (
  `id` VARCHAR(191) NOT NULL,
  `merchant_id` VARCHAR(191) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `bank_name` VARCHAR(191) NOT NULL,
  `bank_account` VARCHAR(191) NOT NULL,
  `bank_holder` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `rejection_reason` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processed_at` DATETIME(3) NULL,
  INDEX `merchant_withdrawals_merchant_id_idx`(`merchant_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `merchant_withdrawals` ADD CONSTRAINT `merchant_withdrawals_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
