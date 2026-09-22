-- CreateTable: tiket bantuan (live chat support)
CREATE TABLE `support_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `role` ENUM('CUSTOMER', 'DRIVER', 'MERCHANT') NOT NULL,
    `from_name` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `needs_admin` BOOLEAN NOT NULL DEFAULT false,
    `handled_by_admin` BOOLEAN NOT NULL DEFAULT false,
    `closed_by` VARCHAR(191) NULL,
    `rating` INTEGER NULL,
    `rating_comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `resolved_at` DATETIME(3) NULL,

    INDEX `support_tickets_user_id_idx`(`user_id`),
    INDEX `support_tickets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: pesan chat dalam tiket
CREATE TABLE `support_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `sender` ENUM('USER', 'BOT', 'ADMIN') NOT NULL,
    `body` TEXT NOT NULL,
    `read_by_user` BOOLEAN NOT NULL DEFAULT false,
    `read_by_admin` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_messages_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `support_messages` ADD CONSTRAINT `support_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
