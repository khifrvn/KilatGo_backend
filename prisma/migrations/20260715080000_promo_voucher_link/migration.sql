-- Banner promo bisa dikaitkan ke voucher (detail/kode tampil saat banner diklik).
ALTER TABLE `promos` ADD COLUMN `voucher_code` VARCHAR(191) NULL;
