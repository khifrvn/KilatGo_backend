-- Foto profil user (file publik di uploads/avatars).
ALTER TABLE `users` ADD COLUMN `avatar` VARCHAR(191) NULL AFTER `name`;
