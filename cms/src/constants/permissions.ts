// Key izin per-menu (harus sama dengan backend rbac.middleware.ts).
export const PERMISSIONS: { key: string; label: string }[] = [
  { key: 'customers', label: 'Pelanggan' },
  { key: 'drivers', label: 'Driver' },
  { key: 'merchants', label: 'Mitra' },
  { key: 'promos', label: 'Promo Banner' },
  { key: 'notifications', label: 'Notifikasi' },
  { key: 'support', label: 'Live Chat Support' },
  { key: 'packages', label: 'Paket Mitra' },
  { key: 'vouchers', label: 'Voucher' },
  { key: 'approval', label: 'Persetujuan' },
  { key: 'attendance', label: 'Absensi' },
  { key: 'orders', label: 'Pesanan' },
  { key: 'ratings', label: 'Rating & Ulasan' },
  { key: 'manual_orders', label: 'Order Manual' },
  { key: 'earnings', label: 'Pendapatan' },
  { key: 'withdrawals', label: 'Penarikan' },
  { key: 'topups', label: 'Isi Saldo' },
  { key: 'ppob', label: 'PPOB (Pulsa & Tagihan)' },
  { key: 'settings', label: 'Pengaturan' },
  { key: 'errors', label: 'Log Error' },
];

type AdminUser = { isSuperAdmin?: boolean; permissions?: string[] } | null;

// Superadmin selalu boleh; key kosong (mis. Dasbor) boleh semua admin.
export function hasPerm(user: AdminUser, key?: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  if (!key) return true;
  return (user.permissions ?? []).includes(key);
}
