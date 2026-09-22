-- Token FCM untuk push notifikasi customer (disimpan di User).
ALTER TABLE `users` ADD COLUMN `fcm_token` TEXT NULL;
