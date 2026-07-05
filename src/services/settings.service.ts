import { prisma } from '../config/database';

// Default pengaturan komisi & tarif (dipakai jika belum diset admin).
export const DEFAULT_SETTINGS: Record<string, string> = {
  commission_percent: '15', // komisi platform (%)
  base_fare: '5000', // tarif dasar (Rp)
  per_km: '2500', // tarif per km (Rp)
  min_fare: '8000', // tarif minimum (Rp)
  food_commission_percent: '20', // komisi KilatFood (%)
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const stored: Record<string, string> = {};
  for (const r of rows) stored[r.key] = r.value;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch: Record<string, unknown>): Promise<Record<string, string>> {
  const entries = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  for (const [key, value] of entries) {
    const v = String(value);
    await prisma.setting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
  }
  return getSettings();
}
