-- Customer: jumlah penilaian dari driver (agar driver bisa lihat "rating (N)")
ALTER TABLE `customers` ADD COLUMN `total_ratings` INT NOT NULL DEFAULT 0 AFTER `rating`;
-- Backfill dari rating driver yang sudah ada
UPDATE `customers` c SET c.`total_ratings` = (
  SELECT COUNT(*) FROM `ratings` r
  JOIN `orders` o ON r.`order_id` = o.`id`
  WHERE o.`customer_id` = c.`id` AND r.`by_role` = 'DRIVER'
);
