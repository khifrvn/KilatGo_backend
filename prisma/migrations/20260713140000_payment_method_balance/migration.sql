-- Tambah metode pembayaran BALANCE (bayar pakai Saldo KilatGo).
ALTER TABLE `orders` MODIFY `payment_method` ENUM('CASH','EWALLET','BANK_TRANSFER','CARD','BALANCE') NOT NULL DEFAULT 'CASH';
ALTER TABLE `payments` MODIFY `method` ENUM('CASH','EWALLET','BANK_TRANSFER','CARD','BALANCE') NOT NULL;
