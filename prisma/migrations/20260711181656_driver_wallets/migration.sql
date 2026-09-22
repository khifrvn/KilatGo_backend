-- AlterTable
ALTER TABLE `drivers` ADD COLUMN `credit_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `earnings_balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `withdraw_pin` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `wallet_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `driver_id` VARCHAR(191) NOT NULL,
    `wallet` ENUM('CREDIT', 'EARNINGS') NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `balance_after` DECIMAL(12, 2) NOT NULL,
    `note` VARCHAR(191) NULL,
    `ref` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wallet_transactions_driver_id_wallet_idx`(`driver_id`, `wallet`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `wallet_transactions` ADD CONSTRAINT `wallet_transactions_driver_id_fkey` FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
