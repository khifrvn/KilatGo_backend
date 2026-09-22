-- AlterTable
ALTER TABLE `orders`
  ADD COLUMN `pickup_photo` VARCHAR(191) NULL,
  ADD COLUMN `package_type` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ratings` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `by_role` VARCHAR(191) NOT NULL,
  `stars` INTEGER NOT NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `ratings_order_id_by_role_key`(`order_id`, `by_role`),
  INDEX `ratings_order_id_idx`(`order_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ratings` ADD CONSTRAINT `ratings_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
