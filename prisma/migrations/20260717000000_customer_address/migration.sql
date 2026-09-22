-- AlterTable: alamat domisili pelanggan (wajib diisi sebelum bisa memesan layanan)
ALTER TABLE `customers` ADD COLUMN `address` TEXT NULL;
