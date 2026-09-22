// Paket promosi mitra (disimpan admin sebagai JSON di Setting `merchant_promo_packages`).
// Murni supaya bisa dites tanpa DB: npx tsx src/utils/promoPackages.ts

export type PromoPackage = { name: string; minutes: number; price: number };

// Parse JSON dari admin; buang entri tak valid (nama kosong / durasi / harga tak wajar).
// Harga 0 diizinkan (admin bisa bikin paket gratis untuk promo perkenalan).
export function parsePromoPackages(raw: string | undefined): PromoPackage[] {
  let arr: unknown;
  try {
    arr = JSON.parse(raw || '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        name: String(o.name ?? '').trim(),
        minutes: Math.floor(Number(o.minutes)),
        price: Math.round(Number(o.price)),
      };
    })
    .filter((p) => p.name !== '' && Number.isFinite(p.minutes) && p.minutes > 0 && Number.isFinite(p.price) && p.price >= 0);
}

// Kapan promosi berakhir setelah beli paket. Kalau masih ada promosi aktif,
// durasinya DITAMBAH dari sisa waktu (tidak hangus); kalau sudah lewat, mulai dari sekarang.
export function promoEndsAt(now: Date, currentEnd: Date | null, minutes: number): Date {
  const from = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return new Date(from.getTime() + minutes * 60 * 1000);
}

// Label durasi enak dibaca (untuk struk/riwayat): 90 → "1 jam 30 menit".
export function durationLabel(minutes: number): string {
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  const parts = [d && `${d} hari`, h && `${h} jam`, m && `${m} menit`].filter(Boolean);
  return parts.length ? parts.join(' ') : '0 menit';
}

if (require.main === module) {
  const p = parsePromoPackages('[{"name":"1 Jam","minutes":60,"price":3500},{"name":"","minutes":60,"price":1},{"name":"X","minutes":0,"price":1},{"name":"Y","minutes":10,"price":-5}]');
  console.assert(p.length === 1 && p[0].minutes === 60 && p[0].price === 3500, 'hanya paket valid yang lolos');
  console.assert(parsePromoPackages('bukan json').length === 0, 'JSON rusak → kosong');
  console.assert(parsePromoPackages(undefined).length === 0, 'kosong → kosong');
  console.assert(parsePromoPackages('[{"name":"Gratis","minutes":30,"price":0}]').length === 1, 'harga 0 boleh');

  const now = new Date('2026-07-25T10:00:00Z');
  console.assert(promoEndsAt(now, null, 60).toISOString() === '2026-07-25T11:00:00.000Z', 'belum promosi → mulai sekarang');
  console.assert(
    promoEndsAt(now, new Date('2026-07-25T10:30:00Z'), 60).toISOString() === '2026-07-25T11:30:00.000Z',
    'masih aktif → sisa waktu ditambah, tidak hangus'
  );
  console.assert(
    promoEndsAt(now, new Date('2026-07-25T09:00:00Z'), 60).toISOString() === '2026-07-25T11:00:00.000Z',
    'sudah lewat → mulai sekarang'
  );
  console.assert(durationLabel(1500) === '1 hari 1 jam', 'label durasi');
  console.assert(durationLabel(90) === '1 jam 30 menit', 'label durasi jam+menit');
  console.log('promoPackages: OK');
}
