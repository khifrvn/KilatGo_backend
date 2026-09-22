-- Transaksi PPOB (Digiflazz): pulsa, paket data, token PLN, e-wallet, voucher game.
CREATE TABLE `ppob_transactions` (
  `id` VARCHAR(191) NOT NULL,
  `customer_id` VARCHAR(191) NOT NULL,
  `ref_id` VARCHAR(191) NOT NULL,
  `sku` VARCHAR(191) NOT NULL,
  `product_name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NULL,
  `brand` VARCHAR(191) NULL,
  `customer_no` VARCHAR(191) NOT NULL,
  `cost_price` DECIMAL(12, 2) NOT NULL,
  `sell_price` DECIMAL(12, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `rc` VARCHAR(191) NULL,
  `message` TEXT NULL,
  `sn` TEXT NULL,
  `refunded` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ppob_transactions_ref_id_key`(`ref_id`),
  INDEX `ppob_transactions_customer_id_status_idx`(`customer_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ppob_transactions` ADD CONSTRAINT `ppob_transactions_customer_id_fkey`
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
