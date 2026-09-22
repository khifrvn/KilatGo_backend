-- Biaya layanan per order (milik platform, tidak masuk pendapatan driver).
ALTER TABLE `orders` ADD COLUMN `service_fee` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `base_fare`;
