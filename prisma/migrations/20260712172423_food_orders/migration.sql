-- AlterEnum: tambah MERCHANT_ACCEPTED ke orders.status
ALTER TABLE `orders` MODIFY `status` ENUM('PENDING','MERCHANT_ACCEPTED','ACCEPTED','DRIVER_ARRIVED','ON_RIDE','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING';

-- AlterTable orders: field FOOD
ALTER TABLE `orders`
  ADD COLUMN `merchant_id` VARCHAR(191) NULL,
  ADD COLUMN `items_total` DECIMAL(10,2) NULL,
  ADD COLUMN `pickup_code` VARCHAR(191) NULL,
  ADD COLUMN `proof_photo` VARCHAR(191) NULL;

-- AlterTable merchants: buka/tutup + fcm
ALTER TABLE `merchants`
  ADD COLUMN `is_open` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `fcm_token` TEXT NULL;

-- CreateTable order_items
CREATE TABLE `order_items` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `menu_id` VARCHAR(191) NULL,
  `name` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `note` TEXT NULL,
  INDEX `order_items_order_id_idx`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Index + FK
CREATE INDEX `orders_merchant_id_idx` ON `orders`(`merchant_id`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_merchant_id_fkey` FOREIGN KEY (`merchant_id`) REFERENCES `merchants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
