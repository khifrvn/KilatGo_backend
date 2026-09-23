-- Token reset sandi sekali pakai (dikirim via email).
-- Disimpan sebagai hash SHA-256, bukan token mentah: bocornya isi tabel tidak
-- langsung memberi akses ganti sandi orang lain.

-- Kolom penanda kapan sandi terakhir diganti. Token dibuat sebelum waktu ini
-- dianggap tidak berlaku (mencabut sesi lama setelah reset sandi).
ALTER TABLE `users` ADD COLUMN `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE TABLE `password_resets` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(191) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `password_resets_token_hash_key`(`token_hash`),
  INDEX `password_resets_user_id_idx`(`user_id`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `password_resets`
  ADD CONSTRAINT `password_resets_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
