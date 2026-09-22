-- Aturan pembatalan customer: simpan waktu & posisi driver saat menerima order.
ALTER TABLE `orders` ADD COLUMN `accepted_at` DATETIME(3) NULL;
ALTER TABLE `orders` ADD COLUMN `driver_accept_lat` DOUBLE NULL;
ALTER TABLE `orders` ADD COLUMN `driver_accept_lng` DOUBLE NULL;
