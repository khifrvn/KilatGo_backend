-- AlterTable
ALTER TABLE `orders` ADD COLUMN `service_type` ENUM('RIDE', 'CAR') NOT NULL DEFAULT 'RIDE';
