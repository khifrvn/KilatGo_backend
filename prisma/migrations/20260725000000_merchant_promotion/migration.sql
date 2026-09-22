-- Promosi berbayar mitra: mitra beli paket durasi (saldo) → warung tampil teratas di KilatFood.
CREATE TABLE `merchant_promotions` (
    `id` VARCHAR(191) NOT NULL,
    `merchant_id` VARCHAR(191) NOT NULL,
    `package_name` VARCHAR(191) NOT NULL,
    `minutes` INTEGER NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `ends_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `merchant_promotions_merchant_id_idx`(`merchant_id`),
    INDEX `merchant_promotions_ends_at_idx`(`ends_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `merchant_promotions` ADD CONSTRAINT `merchant_promotions_merchant_id_fkey`
    FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
