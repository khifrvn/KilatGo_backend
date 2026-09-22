-- Saldo customer + top-up customer (TopUp jadi bisa milik driver ATAU customer).
ALTER TABLE `customers` ADD COLUMN `balance` DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE `topups` MODIFY `driver_id` VARCHAR(191) NULL;
ALTER TABLE `topups` ADD COLUMN `customer_id` VARCHAR(191) NULL;
ALTER TABLE `topups` ADD CONSTRAINT `topups_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
