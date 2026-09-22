-- Rating: target (yang dinilai) + merchant rating (KilatFood: nilai resto & driver)
ALTER TABLE `ratings` ADD COLUMN `target` VARCHAR(191) NOT NULL DEFAULT 'DRIVER';
UPDATE `ratings` SET `target` = 'CUSTOMER' WHERE `by_role` = 'DRIVER';
ALTER TABLE `ratings` DROP INDEX `ratings_order_id_by_role_key`;
ALTER TABLE `ratings` ADD UNIQUE INDEX `ratings_order_id_by_role_target_key` (`order_id`, `by_role`, `target`);
ALTER TABLE `merchants` ADD COLUMN `rating` DOUBLE NOT NULL DEFAULT 5.0;
ALTER TABLE `merchants` ADD COLUMN `total_ratings` INT NOT NULL DEFAULT 0;
