-- AlterTable: KYC pelanggan + rekening + PIN penarikan
ALTER TABLE `customers`
  ADD COLUMN `ktp_photo` VARCHAR(191) NULL,
  ADD COLUMN `selfie_photo` VARCHAR(191) NULL,
  ADD COLUMN `kyc_status` ENUM('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN `bank_name` VARCHAR(191) NULL,
  ADD COLUMN `bank_account` VARCHAR(191) NULL,
  ADD COLUMN `bank_holder` VARCHAR(191) NULL,
  ADD COLUMN `withdraw_pin` VARCHAR(191) NULL;

-- AlterEnum: tambah CUSTOMER ke subjek KYC
ALTER TABLE `kyc_verifications` MODIFY `subject_type` ENUM('DRIVER', 'MERCHANT', 'CUSTOMER') NOT NULL;

-- CreateTable: penarikan saldo pelanggan
CREATE TABLE `customer_withdrawals` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `admin_fee` DECIMAL(12, 2) NOT NULL,
    `net_amount` DECIMAL(12, 2) NOT NULL,
    `bank_name` VARCHAR(191) NOT NULL,
    `bank_account` VARCHAR(191) NOT NULL,
    `bank_holder` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `rejection_reason` TEXT NULL,
    `reference_number` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processed_at` DATETIME(3) NULL,

    INDEX `customer_withdrawals_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_withdrawals` ADD CONSTRAINT `customer_withdrawals_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
