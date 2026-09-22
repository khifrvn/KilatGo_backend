-- AlterTable: kolom order manual
ALTER TABLE `orders`
  ADD COLUMN `is_manual` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `manual_customer_name` VARCHAR(191) NULL,
  ADD COLUMN `manual_customer_phone` VARCHAR(191) NULL,
  ADD COLUMN `manual_items` TEXT NULL,
  ADD COLUMN `items_known` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `payment_url` TEXT NULL,
  ADD COLUMN `payment_ref` VARCHAR(191) NULL;
