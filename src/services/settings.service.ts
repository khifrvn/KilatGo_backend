import { prisma } from '../config/database';

// Default pengaturan komisi & tarif (dipakai jika belum diset admin).
export const DEFAULT_SETTINGS: Record<string, string> = {
  commission_percent: '15', // komisi platform (%)
  base_fare: '5000', // tarif dasar (Rp)
  per_km: '2500', // tarif per km (Rp)
  min_fare: '8000', // tarif minimum (Rp)
  food_commission_percent: '20', // komisi KilatFood (%)
  maintenance_mode: '0', // '1' = app dalam perbaikan (blokir request non-admin)
  maintenance_message: 'Aplikasi sedang dalam perbaikan. Silakan coba lagi nanti.',
  // Kontak (tampil di landing)
  contact_email: 'costumerservice@kilatgo.com',
  contact_phone: '0895418213962',
  contact_whatsapp: '0895418213962',
  contact_address: 'Dusun 3 Rejo Sari, Kwala Begumit, Kec. Stabat, Kab. Langkat, Sumatera Utara',
};

// Key yang boleh diakses publik (landing) — jangan bocorkan setting internal lain.
const PUBLIC_KEYS = ['contact_email', 'contact_phone', 'contact_whatsapp', 'contact_address', 'maintenance_mode', 'maintenance_message'];

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function getPublicSettings(): Promise<Record<string, string>> {
  const all = await getSettings();
  const out: Record<string, string> = {};
  for (const k of PUBLIC_KEYS) out[k] = all[k];
  return out;
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Record<string, string>> {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    const v = String(value);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  return getSettings();
}
