-- Voucher/kupon transaksi (dikelola admin).
CREATE TABLE `vouchers` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `discount_type` ENUM('PERCENT','FIXED','FREE_ONGKIR') NOT NULL,
  `value` DECIMAL(12,2) NOT NULL,
  `max_discount` DECIMAL(12,2) NULL,
  `min_spend` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `services` TEXT NOT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `total_quota` INTEGER NULL,
  `used_count` INTEGER NOT NULL DEFAULT 0,
  `per_user_limit` INTEGER NOT NULL DEFAULT 1,
  `new_user_only` BOOLEAN NOT NULL DEFAULT false,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `vouchers_code_key`(`code`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `voucher_redemptions` (
  `id` VARCHAR(191) NOT NULL,
  `voucher_id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `service_type` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `voucher_redemptions_voucher_id_idx`(`voucher_id`),
  INDEX `voucher_redemptions_customer_id_idx`(`customer_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `voucher_redemptions` ADD CONSTRAINT `voucher_redemptions_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
