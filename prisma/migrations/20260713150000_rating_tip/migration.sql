-- Tip customer → driver disimpan bersama rating.
ALTER TABLE `ratings` ADD COLUMN `tip` DECIMAL(10,2) NOT NULL DEFAULT 0;
