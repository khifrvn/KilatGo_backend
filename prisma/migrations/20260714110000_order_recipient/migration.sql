-- SEND: penerima paket (nama + no telp WhatsApp)
ALTER TABLE `orders`
  ADD COLUMN `recipient_name` VARCHAR(191) NULL AFTER `package_contents`,
  ADD COLUMN `recipient_phone` VARCHAR(191) NULL AFTER `recipient_name`;
