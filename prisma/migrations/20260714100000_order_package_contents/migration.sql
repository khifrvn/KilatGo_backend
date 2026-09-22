-- SEND: isi paket (opsional; disembunyikan customer utk barang berharga)
ALTER TABLE `orders` ADD COLUMN `package_contents` TEXT NULL AFTER `package_type`;
