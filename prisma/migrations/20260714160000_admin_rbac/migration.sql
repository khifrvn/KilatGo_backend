-- RBAC admin: superadmin flag + izin per-menu.
ALTER TABLE `admins`
  ADD COLUMN `is_super_admin` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `permissions` TEXT NULL;

-- Admin lama punya akses penuh sebelum RBAC → jadikan superadmin agar tidak terkunci.
UPDATE `admins` SET `is_super_admin` = 1;

-- Pastikan setiap user ber-role ADMIN punya baris admins (sebagai superadmin).
INSERT INTO `admins` (id, user_id, is_super_admin, permissions, created_at, updated_at)
SELECT UUID(), u.id, 1, NULL, NOW(3), NOW(3)
FROM `users` u
LEFT JOIN `admins` a ON a.user_id = u.id
WHERE u.role = 'ADMIN' AND a.id IS NULL;
