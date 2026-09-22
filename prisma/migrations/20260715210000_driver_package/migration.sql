-- CreateTable
CREATE TABLE `driver_package_orders` (
    `id` VARCHAR(191) NOT NULL,
    `driver_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('PENDING_PAYMENT', 'VERIFIED', 'PROCESSING', 'SHIPPING', 'RECEIVED', 'COMPLETED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `reference_id` VARCHAR(191) NOT NULL,
    `payment_url` TEXT NULL,
    `ipaymu_session_id` VARCHAR(191) NULL,
    `ipaymu_trx_id` VARCHAR(191) NULL,
    `paid_at` DATETIME(3) NULL,
    `admin_note` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `driver_package_orders_reference_id_key`(`reference_id`),
    INDEX `driver_package_orders_driver_id_idx`(`driver_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `driver_package_orders` ADD CONSTRAINT `driver_package_orders_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
