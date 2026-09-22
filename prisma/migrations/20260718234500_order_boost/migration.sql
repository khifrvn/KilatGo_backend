-- AlterTable: boost pencarian driver (radius +2km per klik)
ALTER TABLE `orders`
  ADD COLUMN `boost_km` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `boost_expires_at` DATETIME(3) NULL;
