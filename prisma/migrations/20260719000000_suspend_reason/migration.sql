-- AlterTable: alasan blokir akun (ditampilkan ke pengguna di layar suspend)
ALTER TABLE `users` ADD COLUMN `suspend_reason` TEXT NULL;
