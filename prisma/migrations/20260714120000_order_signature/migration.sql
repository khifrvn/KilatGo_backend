-- SEND: tanda tangan penerima (gambar bukti terima)
ALTER TABLE `orders` ADD COLUMN `signature_photo` VARCHAR(191) NULL AFTER `proof_photo`;
