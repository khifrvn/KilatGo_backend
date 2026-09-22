-- AlterTable
ALTER TABLE `drivers` ADD COLUMN `enabled_services` VARCHAR(191) NULL,
    MODIFY `service_type` ENUM('RIDE', 'CAR', 'SEND', 'FOOD') NOT NULL DEFAULT 'RIDE';

-- AlterTable
ALTER TABLE `orders` MODIFY `service_type` ENUM('RIDE', 'CAR', 'SEND', 'FOOD') NOT NULL DEFAULT 'RIDE';
