-- Placement promo: layar tempat promo tampil (ALL/FOOD/SEND/RIDE/CAR).
ALTER TABLE `promos` ADD COLUMN `placement` VARCHAR(191) NOT NULL DEFAULT 'ALL' AFTER `audience`;
